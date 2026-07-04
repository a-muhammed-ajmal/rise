export default function WellnessLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-28 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>

      {/* Progress card */}
      <div className="h-24 rounded-xl bg-muted animate-pulse" />

      {/* Habit cards */}
      <div className="space-y-3">
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
