export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
        <div className="h-7 w-24 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Cards */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-12 bg-muted/50 animate-pulse border-b border-border" />
        <div className="p-4 space-y-3">
          <div className="flex justify-between"><div className="h-4 w-32 rounded bg-muted animate-pulse" /><div className="h-4 w-20 rounded bg-muted animate-pulse" /></div>
          <div className="flex justify-between"><div className="h-4 w-28 rounded bg-muted animate-pulse" /><div className="h-4 w-16 rounded bg-muted animate-pulse" /></div>
        </div>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-12 bg-muted/50 animate-pulse border-b border-border" />
        <div className="p-4 space-y-3">
          <div className="flex justify-between"><div className="h-4 w-24 rounded bg-muted animate-pulse" /><div className="h-4 w-24 rounded bg-muted animate-pulse" /></div>
          <div className="flex justify-between"><div className="h-4 w-28 rounded bg-muted animate-pulse" /><div className="h-4 w-20 rounded bg-muted animate-pulse" /></div>
          <div className="flex justify-between"><div className="h-4 w-20 rounded bg-muted animate-pulse" /><div className="h-8 w-28 rounded-lg bg-muted animate-pulse" /></div>
        </div>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-12 bg-muted/50 animate-pulse border-b border-border" />
        <div className="p-4 space-y-3">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-8 w-36 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}
