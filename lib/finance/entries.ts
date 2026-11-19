// Rows written by the Finance "Add" dialog's Transfer and Debt tabs.
//
// Pure so the arithmetic and the exact row shapes are unit-tested. Both build
// on the existing schema and the balance trigger (update_payment_method_balance):
//
//   - A transfer fee is a real cost, so it is an ordinary `expense` on the
//     source wallet. It is inserted in the same request as the transfer (one
//     INSERT statement, so both rows land or neither does), counts as money
//     out for the month, and shows up under Budgets like any other spending.
//   - Lending, borrowing and repayments move a wallet without being income or
//     spending, so they are a signed `adjustment` on the chosen wallet,
//     categorised DEBT_CATEGORY so Activity can name them properly.

import type { Database, Debt } from "@/lib/types/database";

export type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

/** Category of the expense row a transfer fee is recorded as. */
export const TRANSFER_FEE_CATEGORY = "Transfer fee";

/** Category of the wallet movement recorded with a debt or a repayment. */
export const DEBT_CATEGORY = "Debt";

// Round to whole fils and fold -0 into 0.
function toFils(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * A money amount typed into a form, rounded to fils. Blank, non-numeric,
 * negative and (unless `allowZero`) zero values are null.
 */
export function parseAmount(value: string, { allowZero = false } = {}): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const amount = toFils(parsed);
  if (amount < 0 || (amount === 0 && !allowZero)) return null;
  return amount;
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export interface TransferInput {
  userId: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  /** Amount that arrives in the destination wallet. */
  amount: number;
  /** Optional charge taken from the source wallet on top of the amount. */
  fee: number;
  note: string;
  /** "yyyy-MM-dd" */
  date: string;
}

/** What leaves the source wallet: the amount plus any fee. */
export function transferTotal(amount: number, fee: number): number {
  return toFils(amount + Math.max(fee, 0));
}

/** The transfer row, followed by a fee expense when there is a fee. */
export function buildTransferRows(input: TransferInput): TransactionInsert[] {
  const route = `${input.fromName} → ${input.toName}`;
  const rows: TransactionInsert[] = [
    {
      user_id: input.userId,
      type: "transfer",
      amount: toFils(input.amount),
      category: "Transfer",
      description: input.note.trim() || route,
      date: input.date,
      from_payment_method_id: input.fromId,
      to_payment_method_id: input.toId,
      payment_method_id: null,
      tags: [],
    },
  ];
  const fee = toFils(input.fee);
  if (fee > 0) {
    rows.push({
      user_id: input.userId,
      type: "expense",
      amount: fee,
      category: TRANSFER_FEE_CATEGORY,
      description: `Fee · ${route}`,
      date: input.date,
      payment_method: input.fromName,
      payment_method_id: input.fromId,
      tags: [],
    });
  }
  return rows;
}

// ─── Debts ────────────────────────────────────────────────────────────────────

export type DebtDirection = Debt["type"];

/**
 * How a new debt moves its wallet: lending (`they_owe`) takes money out of the
 * wallet, borrowing (`i_owe`) puts money into it.
 */
export function newDebtDelta(type: DebtDirection, amount: number): number {
  return type === "they_owe" ? toFils(-amount) : toFils(amount);
}

/**
 * How a repayment moves its wallet: being paid back (`they_owe`) puts money in,
 * paying someone back (`i_owe`) takes it out.
 */
export function repaymentDelta(type: DebtDirection, amount: number): number {
  return type === "they_owe" ? toFils(amount) : toFils(-amount);
}

/** Wallet movement description for a new debt. */
export function newDebtLabel(type: DebtDirection, name: string): string {
  return type === "they_owe" ? `Lent to ${name}` : `Borrowed from ${name}`;
}

/** Wallet movement description for a repayment. */
export function repaymentLabel(type: DebtDirection, name: string): string {
  return type === "they_owe" ? `Repayment from ${name}` : `Repaid to ${name}`;
}

export type RepaymentPlan =
  | { ok: true; settles: true; remaining: 0 }
  | { ok: true; settles: false; remaining: number }
  | { ok: false; error: string };

/**
 * A repayment of `amount` against what is still owed. Paying the whole balance
 * settles the debt (its amount is kept for the settled list); paying part of it
 * leaves the rest outstanding. Paying more than is owed is refused.
 */
export function planRepayment(outstanding: number, amount: number): RepaymentPlan {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount above zero." };
  }
  const remaining = toFils(outstanding - amount);
  if (remaining < 0) {
    return { ok: false, error: "That is more than is still owed." };
  }
  if (remaining === 0) return { ok: true, settles: true, remaining: 0 };
  return { ok: true, settles: false, remaining };
}

/** The signed `adjustment` that moves a wallet for a debt or a repayment. */
export function debtMovementRow({
  userId,
  walletId,
  walletName,
  delta,
  description,
  date,
}: {
  userId: string;
  walletId: string;
  walletName: string;
  delta: number;
  description: string;
  date: string;
}): TransactionInsert {
  return {
    user_id: userId,
    type: "adjustment",
    amount: toFils(delta),
    category: DEBT_CATEGORY,
    description,
    date,
    payment_method: walletName,
    payment_method_id: walletId,
    tags: [],
  };
}
