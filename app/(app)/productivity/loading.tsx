export default function ProductivityLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-32 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex gap-2 overflow-hidden">
        <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 flex-1 rounded-lg bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Task cards */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}
