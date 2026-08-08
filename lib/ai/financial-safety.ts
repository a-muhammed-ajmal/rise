// Decides when a money-writing tool call must be confirmed by the user before
// it executes.
//
// log_expense / log_income stay in AUTO_TOOLS so "coffee, 12 dirhams" still
// happens in one turn. But a mis-heard voice note or a hallucinated amount can
// write a materially wrong figure into the ledger, so the chat route escalates
// to the same signed-approval flow the destructive tools use whenever the
// amount is material or the payload is under-specified.

export const MATERIAL_AMOUNT_AED = 500;

const MONEY_TOOLS = new Set(["log_expense", "log_income"]);

export type FinancialGateReason =
  | "material_amount"
  | "missing_category"
  | "ambiguous_payment_method"
  | "invalid_amount";

export type FinancialGateDecision =
  | { requiresApproval: false }
  | { requiresApproval: true; reason: FinancialGateReason; summary: string };

export function isMoneyTool(toolName: string): boolean {
  return MONEY_TOOLS.has(toolName);
}

/**
 * @param activePaymentMethodCount how many active wallets the user has. With
 *   more than one, omitting payment_method_id means the AI guessed which
 *   wallet to charge — worth a confirmation.
 */
export function evaluateFinancialGate(
  toolName: string,
  input: Record<string, unknown>,
  activePaymentMethodCount: number,
): FinancialGateDecision {
  if (!isMoneyTool(toolName)) return { requiresApproval: false };

  const amount = input.amount;
  const kind = toolName === "log_expense" ? "expense" : "income";

  // Not a usable positive number — let the user see what the model proposed
  // rather than surfacing a bare validation failure.
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return {
      requiresApproval: true,
      reason: "invalid_amount",
      summary: `Log ${kind} with an unclear amount`,
    };
  }

  if (amount > MATERIAL_AMOUNT_AED) {
    return {
      requiresApproval: true,
      reason: "material_amount",
      summary: `Log ${kind} of AED ${amount}`,
    };
  }

  const category = input.category;
  if (typeof category !== "string" || !category.trim()) {
    return {
      requiresApproval: true,
      reason: "missing_category",
      summary: `Log ${kind} of AED ${amount} with no category`,
    };
  }

  if (
    activePaymentMethodCount > 1 &&
    typeof input.payment_method_id !== "string"
  ) {
    return {
      requiresApproval: true,
      reason: "ambiguous_payment_method",
      summary: `Log ${kind} of AED ${amount} (${category}) — wallet not specified`,
    };
  }

  return { requiresApproval: false };
}
