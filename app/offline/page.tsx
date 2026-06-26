"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-5xl">📡</div>
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          RISE can&apos;t reach the server right now. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
