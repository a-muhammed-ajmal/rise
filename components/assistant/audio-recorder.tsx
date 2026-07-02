"use client";

import { useEffect, useRef, useState } from "react";
import { Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type AudioRecorderProps = {
  onRecordingComplete: (blob: Blob, mimeType: string) => void;
  onCancel: () => void;
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function pickMimeType(): string {
  const preferred = "audio/webm;codecs=opus";
  return MediaRecorder.isTypeSupported(preferred) ? preferred : "audio/webm";
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        if (!cancelled) {
          toast.error("Microphone access denied. Please allow microphone permissions and try again.");
          onCancel();
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete(blob, mimeType);
      };

      recorder.start(100); // collect chunks every 100ms

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    void start();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStop() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleCancel() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      // Remove the onstop handler so onRecordingComplete is not called
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 glass-ai rounded-xl">
      {/* Animated recording indicator */}
      <span
        className={cn(
          "inline-block w-3 h-3 rounded-full bg-destructive shrink-0",
          "animate-[glow-pulse_1.5s_ease-in-out_infinite]",
        )}
        aria-hidden
      />

      {/* Elapsed timer */}
      <span className="font-mono text-sm tabular-nums text-foreground">
        {formatElapsed(elapsed)}
      </span>

      <span className="text-xs text-muted-foreground flex-1">Recording…</span>

      {/* Stop */}
      <Button
        type="button"
        size="icon"
        aria-label="Stop recording"
        onClick={handleStop}
        className="h-11 w-11 shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        <Square className="w-4 h-4 fill-current" />
      </Button>

      {/* Cancel */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cancel recording"
        onClick={handleCancel}
        className="h-11 w-11 shrink-0"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
