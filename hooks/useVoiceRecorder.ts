'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from '@/lib/toast';

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
}

// ── Minimal Web Speech API types (not yet universal in TS DOM lib) ─────────────
interface SpeechRecognitionResult {
  readonly 0: { readonly transcript: string };
}
interface SpeechRecognitionResultList {
  readonly 0: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface ISpeechRecognitionCtor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionCtor;
    webkitSpeechRecognition?: ISpeechRecognitionCtor;
  }
}

export function useVoiceRecorder({ onTranscript }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.error('Voice input is not supported in this browser. Please try Chrome or Edge.');
      return;
    }

    // Stop any in-progress recognition first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsRecording(true);

    recognition.onspeechstart = () => setIsTranscribing(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) onTranscript(transcript.trim());
    };

    recognition.onspeechend = () => setIsTranscribing(true);

    recognition.onend = () => {
      setIsRecording(false);
      setIsTranscribing(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      setIsTranscribing(false);
      recognitionRef.current = null;

      if (event.error === 'not-allowed') {
        toast.error('Microphone access denied. Please allow microphone permissions and try again.');
      } else if (event.error === 'no-speech') {
        // Silently ignore — user held mic but didn't speak
      } else if (event.error !== 'aborted') {
        toast.error('Voice input failed. Please try again or type your message.');
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      toast.error('Could not start voice input. Please try again.');
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  return { isRecording, isTranscribing, startRecording, stopRecording };
}
