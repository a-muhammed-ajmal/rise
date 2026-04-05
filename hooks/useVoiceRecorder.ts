'use client';

import { useState, useRef, useCallback } from 'react';

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
}

export interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
}

/**
 * Reusable hook for capturing microphone audio via MediaRecorder.
 * Returns a Blob in webm format (or wav fallback) when stopped.
 */
export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setState({ isRecording: false, isPaused: false, duration: 0, error: null });
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // Prefer webm; fall back to whatever is supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (resolveRef.current) {
          resolveRef.current(blob);
          resolveRef.current = null;
        }
        cleanup();
        setState(s => ({ ...s, isRecording: false }));
      };

      recorder.onerror = () => {
        setState(s => ({ ...s, error: 'Recording failed. Please try again.', isRecording: false }));
        cleanup();
        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }
      };

      recorder.start(250); // collect data every 250ms

      // Duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setState(s => ({ ...s, duration: Math.floor((Date.now() - startTime) / 1000) }));
      }, 1000);

      setState({ isRecording: true, isPaused: false, duration: 0, error: null });
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access in your browser settings.'
          : 'Could not access microphone. Please check your device.';
      setState({ isRecording: false, isPaused: false, duration: 0, error: msg });
    }
  }, [cleanup]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        setState(s => ({ ...s, isRecording: false }));
        resolve(null);
        return;
      }
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // Remove onstop handler to avoid resolving
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    if (resolveRef.current) {
      resolveRef.current(null);
      resolveRef.current = null;
    }
    setState({ isRecording: false, isPaused: false, duration: 0, error: null });
  }, [cleanup]);

  return { state, startRecording, stopRecording, cancelRecording };
}
