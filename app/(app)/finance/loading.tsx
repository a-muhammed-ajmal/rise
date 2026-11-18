// Mirrors the Finance Home layout (Home | Money switch → net worth hero →
// this month + needs attention) so nothing jumps when the data arrives.
export default function FinanceLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading finance">
      {/* Home | Money switch */}
      <div className="h-11 w-full rounded-lg bg-muted animate-pulse md:w-80" />

      {/* Net worth hero: phones stack the three parts, desktop puts them side by side */}
      <div className="h-60 rounded-lg bg-muted animate-pulse md:h-56" />

      {/* This month and Needs attention — stacked on phones, side by side from md */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-52 rounded-lg bg-muted animate-pulse" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}
