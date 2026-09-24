// The dashboard is the app's landing route and its slowest server render — it
// runs eight Supabase queries before it can return any markup. Without a
// loading file the whole App Router segment stayed suspended, so a cold open
// (a PWA launch in particular) showed the splash screen until every query had
// come back. This skeleton is static, so Next streams it immediately and the
// real content swaps in underneath. Mirrors the live layout: header, three
// stat tiles, quote, focus, habits, tasks, then the two-column row.
export default function DashboardLoading() {
  return (
    <div className="p-3 md:p-5 space-y-5 max-w-4xl">
      {/* Greeting */}
      <div className="space-y-2">
        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
        <div className="h-8 w-52 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Quick stats — same 3-up grid as the live page */}
      <div className="grid grid-flow-col auto-cols-[calc((100%-1rem)/3)] gap-2 md:grid-flow-row md:grid-cols-3 md:auto-cols-auto md:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>

      {/* Quote → Focus → Habits → Tasks */}
      <div className="space-y-4">
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      </div>

      {/* Goals + AI assistant */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-44 rounded-xl bg-muted animate-pulse" />
        <div className="h-44 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
