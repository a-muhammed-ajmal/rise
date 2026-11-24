// The dashboard is the app's landing route and its slowest server render — it
// waits on its Supabase queries before it can return any markup. Without a
// loading file the whole App Router segment stayed suspended, so a cold open
// (a PWA launch in particular) showed the splash screen until every query had
// come back. This skeleton is static, so Next streams it immediately and the
// real content swaps in underneath. Mirrors the live layout: greeting, quote,
// three stat tiles, today's work in two columns, contacts + goals, assistant.
export default function DashboardLoading() {
  return (
    <div
      className="page-shell"
      role="status"
      aria-busy="true"
      aria-label="Loading Home"
    >
      {/* Greeting + daily quote */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="h-3 w-40 rounded bg-muted animate-pulse" />
          <div className="h-8 w-52 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-12 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Quick stats — same 3-up grid as the live page */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>

      {/* Focus + Tasks | Habits + Needs attention */}
      <div className="grid items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        <div className="space-y-6">
          <div className="h-36 rounded-lg bg-muted animate-pulse" />
          <div className="h-64 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="space-y-6">
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>

      {/* Touch Base + Goals */}
      <div className="grid items-start gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        <div className="h-56 rounded-lg bg-muted animate-pulse" />
        <div className="h-56 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* AI Assistant */}
      <div className="h-20 rounded-lg bg-muted animate-pulse" />
      <span className="sr-only">Loading Home</span>
    </div>
  );
}
