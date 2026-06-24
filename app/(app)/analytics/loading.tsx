export default function AnalyticsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-10 max-w-6xl">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-32 rounded-lg bg-muted animate-pulse" />
        <div className="h-4 w-48 rounded bg-muted animate-pulse" />
      </div>

      {/* Section skeletons — 4 sections */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 h-56 rounded-xl bg-muted animate-pulse" />
            <div className="h-56 rounded-xl bg-muted animate-pulse" />
            <div className="h-56 rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
