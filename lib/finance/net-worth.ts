// Net worth for the Finance overview: what you hold in your wallets, plus what
// other people still owe you, minus what you still owe them.
//
// Pure and UI-agnostic so the arithmetic is unit-tested on its own. Only
// outstanding debts count — a debt that is paid (`paid_at`) or in the recycle
// bin (`deleted_at`) no longer changes what you are worth. The Finance page
// already filters both out in its query; the guard here keeps the figure right
// for any other caller.

import type { Debt } from "@/lib/types/database";

export type NetWorthDebt = Pick<
  Debt,
  "type" | "amount" | "paid_at" | "deleted_at"
>;

export interface NetWorthSummary {
  /** Sum of the active wallet balances passed in. */
  walletBalance: number;
  /** Outstanding money other people owe you (`they_owe`). */
  owedToYou: number;
  /** Outstanding money you owe other people (`i_owe`). */
  youOwe: number;
  /** walletBalance + owedToYou − youOwe */
  netWorth: number;
  /** Number of outstanding `they_owe` records. */
  owedToYouCount: number;
  /** Number of outstanding `i_owe` records. */
  youOweCount: number;
}

// Round to whole fils so float noise (0.1 + 0.2) never reaches the screen, and
// fold -0 into 0 so an exactly-balanced position is not shown as "-AED 0.00".
function toFils(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function summarizeNetWorth(
  walletBalance: number,
  debts: readonly NetWorthDebt[],
): NetWorthSummary {
  let owedToYou = 0;
  let youOwe = 0;
  let owedToYouCount = 0;
  let youOweCount = 0;

  for (const debt of debts) {
    if (debt.paid_at || debt.deleted_at) continue;
    const amount = Number(debt.amount);
    if (!Number.isFinite(amount)) continue;
    if (debt.type === "they_owe") {
      owedToYou += amount;
      owedToYouCount += 1;
    } else if (debt.type === "i_owe") {
      youOwe += amount;
      youOweCount += 1;
    }
  }

  const wallets = Number.isFinite(walletBalance) ? walletBalance : 0;

  return {
    walletBalance: toFils(wallets),
    owedToYou: toFils(owedToYou),
    youOwe: toFils(youOwe),
    netWorth: toFils(wallets + owedToYou - youOwe),
    owedToYouCount,
    youOweCount,
  };
}
