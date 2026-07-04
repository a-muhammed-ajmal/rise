"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Habit } from "@/lib/types/database";

interface Props {
  habit: Habit | null;
  onClose: () => void;
}

export function AffirmationDialog({ habit, onClose }: Props) {
  const lines = habit?.description?.split("\n").filter(Boolean) ?? [];

  return (
    <Dialog open={!!habit} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: habit?.color ?? "var(--brand)" }}
            />
            {habit?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {lines.map((line, i) => (
            <p key={i} className="text-sm flex gap-2">
              <span className="text-muted-foreground shrink-0">•</span>
              {line}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
