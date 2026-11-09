// Mirrors the Finance page's real layout (wallet tiles → monthly summary →
// navigation → overview cards) so nothing jumps when the data arrives.
export default function FinanceLoading() {
  return (
    <div className="page-shell" aria-busy="true" aria-label="Loading finance">
      {/* Wallet tiles: two per row on phones, intrinsic columns from md up */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Monthly summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-11 w-40 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-24 rounded-lg bg-muted animate-pulse" />
          <div className="col-span-2 h-12 rounded-lg bg-muted animate-pulse md:col-span-1 md:h-24" />
        </div>
      </div>

      {/* Navigation */}
      <div className="h-11 rounded bg-muted animate-pulse" />

      {/* Overview cards */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <div className="h-56 rounded-lg bg-muted animate-pulse" />
        <div className="h-56 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}
