import { ChevronRight, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAED, formatAEDWrappable } from "@/lib/format";
import type { NetWorthSummary } from "@/lib/finance/net-worth";
import { cn } from "@/lib/utils";

function signed(amount: number, sign: "+" | "−"): string {
  return amount === 0 ? formatAED(0) : `${sign}${formatAED(Math.abs(amount))}`;
}

/**
 * Finance overview card: wallet balance plus money owed to you, minus money you
 * owe. Shows the headline figure first and the three parts underneath so the
 * total can always be checked by eye.
 */
export function NetWorthCard({
  summary,
  onViewDebts,
}: {
  summary: NetWorthSummary;
  onViewDebts?: () => void;
}) {
  const {
    walletBalance,
    owedToYou,
    youOwe,
    netWorth,
    owedToYouCount,
    youOweCount,
  } = summary;
  const negative = netWorth < 0;

  return (
    <section
      aria-labelledby="net-worth-title"
      className="flex min-w-0 flex-col gap-3 rounded-lg border-[1.5px] border-border bg-card p-4 shadow-card"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-mod-finance-tint text-mod-finance"
          aria-hidden="true"
        >
          <Scale className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="net-worth-title" className="text-h2 font-semibold">
            Net worth
          </h2>
          <p className="text-label text-muted-foreground">
            Wallets + owed to you − you owe
          </p>
        </div>
      </div>

      <div className="min-w-0">
        {/* Plain className, not cn(): tailwind-merge does not know the
            custom text-metric size and would drop it as a "colour" clash. */}
        <p
          className={`text-metric font-semibold tabular-nums break-words ${
            negative ? "text-[var(--color-danger)]" : ""
          }`}
          data-testid="net-worth-total"
        >
          {formatAEDWrappable(netWorth)}
        </p>
        {negative && (
          <p className="mt-1 text-label text-[var(--color-danger)]">
            Negative — you owe more than you hold
          </p>
        )}
      </div>

      <dl className="min-w-0 divide-y divide-border border-t border-border text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <dt className="text-muted-foreground">Wallet balance</dt>
          <dd
            className={cn(
              "font-medium tabular-nums break-words",
              walletBalance < 0 && "text-[var(--color-danger)]",
            )}
          >
            {formatAED(walletBalance)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <dt className="text-muted-foreground">
            Owed to you{owedToYouCount > 0 && ` (${owedToYouCount})`}
          </dt>
          <dd
            className={cn(
              "font-medium tabular-nums break-words",
              owedToYou > 0 && "text-[var(--color-success)]",
            )}
          >
            {signed(owedToYou, "+")}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <dt className="text-muted-foreground">
            You owe{youOweCount > 0 && ` (${youOweCount})`}
          </dt>
          <dd
            className={cn(
              "font-medium tabular-nums break-words",
              youOwe > 0 && "text-[var(--color-danger)]",
            )}
          >
            {signed(youOwe, "−")}
          </dd>
        </div>
      </dl>

      {onViewDebts && (
        <Button
          variant="ghost"
          size="sm"
          className="-mx-3 -mb-2 self-start text-brand-text"
          onClick={onViewDebts}
        >
          Manage debts
          <ChevronRight data-icon="inline-end" aria-hidden="true" />
        </Button>
      )}
    </section>
  );
}
