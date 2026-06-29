"use client";

import { X, FileText, Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatAttachmentCategory } from "@/lib/types/database";

export type AttachmentStatus = "uploading" | "done" | "error";

export type AttachmentChipProps = {
  id: string;
  filename: string;
  size_bytes: number;
  category: ChatAttachmentCategory;
  mime_type: string;
  status: AttachmentStatus;
  progress: number;
  errorMessage?: string;
  previewUrl?: string;
  onRemove: (id: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusLabel({
  status,
  category,
}: {
  status: AttachmentStatus;
  category: ChatAttachmentCategory;
}) {
  if (status === "done") return null;
  if (status === "error") return null;
  if (category === "audio") {
    return (
      <span className="text-xs text-mod-ai">Transcribing…</span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">Uploading…</span>
  );
}

export function AttachmentChip({
  id,
  filename,
  size_bytes,
  category,
  mime_type,
  status,
  progress,
  errorMessage,
  previewUrl,
  onRemove,
}: AttachmentChipProps) {
  const isError = status === "error";
  const isUploading = status === "uploading";

  return (
    <div
      className={cn(
        "glass-ai flex flex-col gap-1 px-3 py-2 rounded-xl max-w-[200px] min-h-[44px]",
        isError && "border border-destructive",
        !isError && "border border-transparent",
      )}
    >
      <div className="flex items-center gap-2">
        {/* Thumbnail / icon */}
        <div className="shrink-0">
          {category === "image" && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={filename}
              className="w-8 h-8 rounded object-cover"
            />
          ) : category === "audio" ? (
            <Music className="w-5 h-5 text-mod-ai" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground" />
          )}
        </div>

        {/* Filename + size */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight">{filename}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(size_bytes)}
          </p>
        </div>

        {/* Remove button or spinner */}
        {isUploading ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${filename}`}
            onClick={() => onRemove(id)}
            className="w-6 h-6 shrink-0 rounded-full p-0 hover:bg-destructive/10"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="w-full h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-mod-ai rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status label */}
      <StatusLabel status={status} category={category} />

      {/* Error message */}
      {isError && errorMessage && (
        <p className="text-xs text-destructive leading-tight">{errorMessage}</p>
      )}

      {/* Hidden MIME for screen readers */}
      <span className="sr-only">{mime_type}</span>
    </div>
  );
}
