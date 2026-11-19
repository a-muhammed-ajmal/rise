import { ChevronRight, Scale } from "lucide-react";
import type { PaymentMethod } from "@/lib/types/database";
import { formatAED, formatAEDWrappable } from "@/lib/format";
import type { NetWorthSummary } from "@/lib/finance/net-worth";

export type HeroWallet = Pick<PaymentMethod, "id" | "name" | "balance" | "color">;

function signed(amount: number, sign: "+" | "−"): string {
  return amount === 0 ? formatAED(0) : `${sign}${formatAED(Math.abs(amount))}`;
}

function DebtTile({
  label,
  count,
  value,
  onClick,
}: {
  label: string;
  count: number;
  value: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-1 text-label text-white/85">
        <span className="min-w-0 break-words">
          {label}
          {count > 0 ? ` (${count})` : ""}
        </span>
        {onClick && <ChevronRight className="size-3.5 shrink-0 text-white/70" aria-hidden="true" />}
      </span>
      <span className="mt-1 block text-sm font-semibold tabular-nums break-words">{value}</span>
    </>
  );
  const box =
    "block min-w-0 rounded-lg border border-white/15 bg-black/15 px-3 py-2.5 text-left";
  if (!onClick) return <div className={box}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${box} min-h-11 transition-colors hover:bg-black/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
    >
      {body}
    </button>
  );
}

/**
 * Finance hero: net worth on a deep green card, then every active wallet with
 * its exact balance and their total (the money actually available), then what
 * is owed each way. The parts always add up to the headline: available +
 * owed to you − you owe. A negative total is labelled in words, not by colour.
 */
export function NetWorthCard({
  summary,
  wallets,
  onViewDebts,
}: {
  summary: NetWorthSummary;
  /** Active wallets, in display order. */
  wallets: readonly HeroWallet[];
  onViewDebts?: () => void;
}) {
  const { walletBalance, owedToYou, youOwe, netWorth, owedToYouCount, youOweCount } = summary;
  const negative = netWorth < 0;

  return (
    <section
      aria-labelledby="net-worth-title"
      className="finance-hero relative grid min-w-0 gap-4 overflow-hidden p-4 md:grid-cols-2 md:gap-x-6 md:p-6"
    >
      {/* Headline */}
      <div className="min-w-0 md:col-start-1 md:row-start-1">
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
        <p className="text-metric mt-3 font-semibold break-words md:text-hero" data-testid="net-worth-total">
          {formatAEDWrappable(netWorth)}
        </p>
      </div>

      {/* Accounts and the money available */}
      <div className="min-w-0 overflow-hidden rounded-lg border border-white/15 bg-black/15 md:col-start-2 md:row-span-2 md:row-start-1">
        <h3 className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1 text-label font-medium tracking-wide text-white/85 uppercase">
          <span>Accounts</span>
          <span className="tabular-nums normal-case">{wallets.length}</span>
        </h3>
        {wallets.length === 0 ? (
          <p className="px-3 pb-2.5 text-label text-white/85">No active wallets yet.</p>
        ) : (
          <ul aria-label="Wallet balances" className="divide-y divide-white/10">
            {wallets.map((wallet) => (
              <li key={wallet.id} className="flex min-h-10 items-center gap-2.5 px-3 py-2 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full ring-2 ring-white/30"
                  style={{ backgroundColor: wallet.color ?? "rgba(255, 255, 255, 0.7)" }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 break-words">{wallet.name}</span>
                <span className="shrink-0 font-medium tabular-nums whitespace-nowrap">
                  {formatAED(wallet.balance)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/20 bg-black/10 px-3 py-2.5">
          <span className="text-sm font-medium">Total available</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums whitespace-nowrap" data-testid="wallet-total">
            {formatAED(walletBalance)}
          </span>
        </div>
      </div>

      {/* Owed each way */}
      <div className="grid min-w-0 grid-cols-2 gap-2.5 md:col-start-1 md:row-start-2 md:self-end">
        <DebtTile label="Owed to you" count={owedToYouCount} value={signed(owedToYou, "+")} onClick={onViewDebts} />
        <DebtTile label="You owe" count={youOweCount} value={signed(youOwe, "−")} onClick={onViewDebts} />
      </div>
    </section>
  );
}
