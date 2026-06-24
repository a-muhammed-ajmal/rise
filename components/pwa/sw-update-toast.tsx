"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SWUpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setWaiting(reg.waiting);
      }
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(newWorker);
          }
        });
      });
    });
  }, []);

  function handleUpdate() {
    if (!waiting) return;
    waiting.postMessage("SKIP_WAITING");
    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") {
        window.location.reload();
      }
    });
  }

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-surface border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg"
    >
      <RefreshCw className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm text-foreground">Update available</span>
      <Button size="sm" onClick={handleUpdate}>
        Refresh
      </Button>
    </div>
  );
}
