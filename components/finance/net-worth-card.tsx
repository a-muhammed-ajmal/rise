import { Scale } from "lucide-react";
import { formatAED, formatAEDWrappable } from "@/lib/format";
import type { NetWorthSummary } from "@/lib/finance/net-worth";

function signed(amount: number, sign: "+" | "−"): string {
  return amount === 0 ? formatAED(0) : `${sign}${formatAED(Math.abs(amount))}`;
}

/**
 * Finance home hero: net worth on a deep green card, with the three parts of
 * the sum underneath (wallets + owed to you − you owe) so the total can always
 * be checked by eye. A negative total is labelled in words, not by colour.
 */
export function NetWorthCard({
  summary,
  onViewDebts,
}: {
  summary: NetWorthSummary;
  onViewDebts?: () => void;
}) {
  const { walletBalance, owedToYou, youOwe, netWorth, owedToYouCount, youOweCount } = summary;
  const negative = netWorth < 0;

  return (
    <section aria-labelledby="net-worth-title" className="finance-hero relative min-w-0 overflow-hidden p-5 md:p-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden="true">
          <Scale className="size-4" />
        </span>
        <h2 id="net-worth-title" className="text-sm font-medium text-white/90">
          Net worth
        </h2>
        {negative && (
          <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-label font-medium">
            Below zero
          </span>
        )}
      </div>

      <p className="text-hero mt-3 font-semibold break-words" data-testid="net-worth-total">
        {formatAEDWrappable(netWorth)}
      </p>
      <p className="mt-1.5 text-label text-white/85">
        {negative ? "Negative — you owe more than you hold" : "Wallets + money owed to you − money you owe"}
      </p>

      {/* Phones: one row per part (label left, amount right) so an amount never
          splits from its sign. From md: three columns side by side. */}
      <dl className="mt-4 grid gap-1.5 border-t border-white/20 pt-3 text-sm md:grid-cols-3 md:gap-3">
        {[
          { label: "Wallet balance", value: formatAED(walletBalance) },
          { label: `Owed to you${owedToYouCount > 0 ? ` (${owedToYouCount})` : ""}`, value: signed(owedToYou, "+") },
          { label: `You owe${youOweCount > 0 ? ` (${youOweCount})` : ""}`, value: signed(youOwe, "−") },
        ].map((part) => (
          <div key={part.label} className="flex min-w-0 items-baseline justify-between gap-3 md:block">
            <dt className="text-label text-white/85">{part.label}</dt>
            <dd className="font-medium tabular-nums whitespace-nowrap md:mt-0.5">{part.value}</dd>
          </div>
        ))}
      </dl>

      {onViewDebts && (
        <button
          type="button"
          onClick={onViewDebts}
          className="mt-3 -mb-1 inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Manage debts
          <span aria-hidden="true">›</span>
        </button>
      )}
    </section>
  );
}
