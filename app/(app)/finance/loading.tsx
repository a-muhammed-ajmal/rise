export default function FinanceLoading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>

      {/* Wallet cards */}
      <div className="flex gap-3 overflow-hidden">
        <div className="h-24 w-40 rounded-xl bg-muted animate-pulse shrink-0" />
        <div className="h-24 w-40 rounded-xl bg-muted animate-pulse shrink-0" />
        <div className="h-24 w-40 rounded-xl bg-muted animate-pulse shrink-0" />
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
      </div>

      {/* Transaction list */}
      <div className="space-y-3">
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}
