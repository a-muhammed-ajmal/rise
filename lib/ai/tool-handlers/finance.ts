// Finance: wallets, transactions, transfers and adjustments, budgets and debts.
//
// Every query filters by user_id itself: the MCP path runs these handlers
// with a service-role client that bypasses RLS.
import { formatAED } from "@/lib/format";
import { z } from "zod";
import { dbErr, badInput, isOwnedBy, notOwned, DEFAULT_PAGE_SIZE, pageOf, pagedResult, rangeFor, softDeleteRecord, type ToolHandlers } from "./shared";
import { dateStr, uuid, offsetInput } from "./schemas";

const LogMoneyInput = z.object({
  amount: z.number().positive().max(10_000_000),
  category: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
  payment_method_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(50)).optional(),
});

const ListTransactionsInput = z.object({
  type: z
    .enum(["income", "expense", "transfer", "adjustment", "all"])
    .optional(),
  start_date: dateStr.optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: offsetInput,
});

const UpdateTransactionInput = z.object({
  transaction_id: uuid,
  summary: z.string().max(500),
  amount: z.number().positive().max(10_000_000).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  date: dateStr.optional(),
  tags: z.array(z.string().max(50)).optional(),
});

const CreateTransferInput = z
  .object({
    from_payment_method_id: uuid,
    to_payment_method_id: uuid,
    amount: z.number().positive().max(10_000_000),
    date: dateStr.optional(),
    description: z.string().max(500).optional().nullable(),
    summary: z.string().max(500),
  })
  .refine((d) => d.from_payment_method_id !== d.to_payment_method_id, {
    message: "Source and destination wallet must be different",
  });

const CreateAdjustmentInput = z.object({
  payment_method_id: uuid,
  amount: z
    .number()
    .refine((n) => Number.isFinite(n) && n !== 0 && Math.abs(n) <= 10_000_000, {
      message: "Amount must be a nonzero number",
    }),
  reason: z.string().min(1).max(500),
  date: dateStr.optional(),
  summary: z.string().max(500),
});

const DeleteTransactionInput = z.object({
  transaction_id: uuid,
  transaction_summary: z.string().optional(),
});

// Budgets
const CreateBudgetInput = z.object({
  category: z.string().min(1).max(100),
  amount: z.number().positive().max(10_000_000),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr,
  period_end: dateStr,
});

const UpdateBudgetInput = z.object({
  id: uuid,
  category: z.string().max(100).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  period: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  period_start: dateStr.optional(),
  period_end: dateStr.optional(),
});

const DeleteBudgetInput = z.object({
  budget_id: uuid,
  budget_summary: z.string().optional(),
});

// Debts
const ListDebtsInput = z.object({
  filter: z.enum(["i_owe", "they_owe", "unpaid", "all"]).optional(),
});

const CreateDebtInput = z.object({
  creditor: z.string().min(1).max(200),
  type: z.enum(["i_owe", "they_owe"]),
  amount: z.number().positive().max(10_000_000),
  description: z.string().max(500).optional().nullable(),
  due_date: dateStr.optional().nullable(),
});

const UpdateDebtInput = z.object({
  debt_id: uuid,
  summary: z.string().max(500),
  creditor: z.string().max(200).optional(),
  type: z.enum(["i_owe", "they_owe"]).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  description: z.string().max(500).optional().nullable(),
  due_date: dateStr.optional().nullable(),
  mark_paid: z.boolean().optional(),
});

const DeleteDebtInput = z.object({
  debt_id: uuid,
  debt_summary: z.string().optional(),
});

export const financeHandlers = {
  list_payment_methods: async ({ supabase, userId }) => {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("id, name, balance, color, is_active, display_order")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("display_order");
    if (error) return dbErr("list_payment_methods", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} payment methods`,
      data,
    };
  },

  log_expense: async ({ input, supabase, userId, today }) => {
    const p = LogMoneyInput.safeParse(input);
    if (!p.success) return badInput();
    // A foreign payment_method_id would move another user's wallet balance
    // via the balance trigger.
    if (
      p.data.payment_method_id &&
      !(await isOwnedBy(
        supabase,
        "payment_methods",
        p.data.payment_method_id,
        userId,
      ))
    )
      return notOwned("Payment method");
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "expense",
      amount: p.data.amount,
      category: p.data.category,
      description: p.data.description ?? null,
      date: p.data.date ?? today,
      payment_method_id: p.data.payment_method_id ?? null,
      tags: p.data.tags ?? [],
    });
    if (error) return dbErr("log_expense", error);
    return {
      success: true,
      message: `Logged expense: ${formatAED(p.data.amount)} for ${p.data.category}`,
    };
  },

  log_income: async ({ input, supabase, userId, today }) => {
    const p = LogMoneyInput.safeParse(input);
    if (!p.success) return badInput();
    if (
      p.data.payment_method_id &&
      !(await isOwnedBy(
        supabase,
        "payment_methods",
        p.data.payment_method_id,
        userId,
      ))
    )
      return notOwned("Payment method");
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "income",
      amount: p.data.amount,
      category: p.data.category,
      description: p.data.description ?? null,
      date: p.data.date ?? today,
      payment_method_id: p.data.payment_method_id ?? null,
      tags: p.data.tags ?? [],
    });
    if (error) return dbErr("log_income", error);
    return {
      success: true,
      message: `Logged income: ${formatAED(p.data.amount)} from ${p.data.category}`,
    };
  },

  list_transactions: async ({ input, supabase, userId }) => {
    const p = ListTransactionsInput.safeParse(input);
    const typeFilter = p.success ? p.data.type : "all";
    const startDate = p.success ? p.data.start_date : undefined;
    const limitVal =
      p.success && p.data.limit ? p.data.limit : DEFAULT_PAGE_SIZE;
    const offsetVal = (p.success && p.data.offset) || 0;
    let query = supabase
      .from("transactions")
      .select(
        "id, type, amount, category, description, date, payment_method, payment_method_id, from_payment_method_id, to_payment_method_id",
      )
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (typeFilter && typeFilter !== "all")
      query = query.eq("type", typeFilter);
    if (startDate) query = query.gte("date", startDate);
    const { data, error } = await query
      .order("date", { ascending: false })
      .range(...rangeFor(limitVal, offsetVal));
    if (error) return dbErr("list_transactions", error);
    return pagedResult("transactions", pageOf(data, limitVal, offsetVal));
  },

  update_transaction: async ({ input, supabase, userId }) => {
    const p = UpdateTransactionInput.safeParse(input);
    if (!p.success) return badInput();
    const { transaction_id, summary: _ts, ...updates } = p.data;
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", transaction_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing)
      return { success: false, message: "Transaction not found" };
    const { error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", transaction_id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_transaction", error);
    return { success: true, message: "Transaction updated." };
  },

  delete_transaction: async ({ input, supabase, userId }) => {
    const p = DeleteTransactionInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "transaction",
      p.data.transaction_id,
      userId,
      "delete_transaction",
    );
  },

  create_transfer: async ({ input, supabase, userId, today }) => {
    const p = CreateTransferInput.safeParse(input);
    if (!p.success) return badInput();
    const [fromOwned, toOwned] = await Promise.all([
      isOwnedBy(
        supabase,
        "payment_methods",
        p.data.from_payment_method_id,
        userId,
      ),
      isOwnedBy(
        supabase,
        "payment_methods",
        p.data.to_payment_method_id,
        userId,
      ),
    ]);
    if (!fromOwned) return notOwned("Source payment method");
    if (!toOwned) return notOwned("Destination payment method");
    const { error, data } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "transfer",
        amount: p.data.amount,
        category: "Transfer",
        description: p.data.description ?? null,
        date: p.data.date ?? today,
        from_payment_method_id: p.data.from_payment_method_id,
        to_payment_method_id: p.data.to_payment_method_id,
        payment_method_id: null,
        tags: [],
      })
      .select()
      .single();
    if (error) return dbErr("create_transfer", error);
    return { success: true, message: `Transferred ${formatAED(p.data.amount)}`, data };
  },

  create_adjustment: async ({ input, supabase, userId, today }) => {
    const p = CreateAdjustmentInput.safeParse(input);
    if (!p.success) return badInput();
    if (
      !(await isOwnedBy(
        supabase,
        "payment_methods",
        p.data.payment_method_id,
        userId,
      ))
    )
      return notOwned("Payment method");
    const { error, data } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type: "adjustment",
        amount: p.data.amount,
        category: "Balance Adjustment",
        description: p.data.reason,
        date: p.data.date ?? today,
        payment_method_id: p.data.payment_method_id,
        tags: [],
      })
      .select()
      .single();
    if (error) return dbErr("create_adjustment", error);
    return {
      success: true,
      message: `Adjusted balance by ${formatAED(p.data.amount)}`,
      data,
    };
  },

  list_budgets: async ({ supabase, userId }) => {
    const { data, error } = await supabase
      .from("budgets")
      .select("id, category, amount, period, period_start, period_end")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("period_end", { ascending: false });
    if (error) return dbErr("list_budgets", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} budgets`,
      data,
    };
  },

  create_budget: async ({ input, supabase, userId }) => {
    const p = CreateBudgetInput.safeParse(input);
    if (!p.success) return badInput();
    const { error, data } = await supabase
      .from("budgets")
      .insert({
        user_id: userId,
        category: p.data.category,
        amount: p.data.amount,
        period: p.data.period ?? "monthly",
        period_start: p.data.period_start,
        period_end: p.data.period_end,
      })
      .select()
      .single();
    if (error) return dbErr("create_budget", error);
    return {
      success: true,
      message: `Created budget: ${p.data.category} ${formatAED(p.data.amount)}`,
      data,
    };
  },

  update_budget: async ({ input, supabase, userId }) => {
    const p = UpdateBudgetInput.safeParse(input);
    if (!p.success) return badInput();
    const { id, ...updates } = p.data;
    const { error } = await supabase
      .from("budgets")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_budget", error);
    return { success: true, message: "Budget updated." };
  },

  delete_budget: async ({ input, supabase, userId }) => {
    const p = DeleteBudgetInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "budget",
      p.data.budget_id,
      userId,
      "delete_budget",
    );
  },

  list_debts: async ({ input, supabase, userId }) => {
    const p = ListDebtsInput.safeParse(input);
    const filter = p.success ? (p.data.filter ?? "all") : "all";
    let query = supabase
      .from("debts")
      .select("id, creditor, type, amount, description, due_date, paid_at")
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (filter === "i_owe") query = query.eq("type", "i_owe");
    else if (filter === "they_owe") query = query.eq("type", "they_owe");
    else if (filter === "unpaid") query = query.is("paid_at", null);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) return dbErr("list_debts", error);
    return {
      success: true,
      message: `Found ${data?.length ?? 0} debt records`,
      data,
    };
  },

  create_debt: async ({ input, supabase, userId }) => {
    const p = CreateDebtInput.safeParse(input);
    if (!p.success) return badInput();
    const direction = p.data.type === "i_owe" ? "owed to" : "owed by";
    const { error, data } = await supabase
      .from("debts")
      .insert({
        user_id: userId,
        creditor: p.data.creditor,
        type: p.data.type,
        amount: p.data.amount,
        description: p.data.description ?? null,
        due_date: p.data.due_date ?? null,
      })
      .select()
      .single();
    if (error) return dbErr("create_debt", error);
    return {
      success: true,
      message: `Recorded ${formatAED(p.data.amount)} ${direction} ${p.data.creditor}`,
      data,
    };
  },

  update_debt: async ({ input, supabase, userId }) => {
    const p = UpdateDebtInput.safeParse(input);
    if (!p.success) return badInput();
    const { debt_id, summary: _ds, mark_paid, ...updates } = p.data;
    const { data: existing } = await supabase
      .from("debts")
      .select("id, creditor")
      .eq("id", debt_id)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return { success: false, message: "Debt not found" };
    const payload = {
      ...updates,
      ...(mark_paid ? { paid_at: new Date().toISOString() } : {}),
    };
    const { error } = await supabase
      .from("debts")
      .update(payload)
      .eq("id", debt_id)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) return dbErr("update_debt", error);
    return {
      success: true,
      message: mark_paid
        ? `Marked debt to ${existing.creditor} as paid.`
        : "Debt updated.",
    };
  },

  delete_debt: async ({ input, supabase, userId }) => {
    const p = DeleteDebtInput.safeParse(input);
    if (!p.success) return badInput();
    return softDeleteRecord(
      supabase,
      "debt",
      p.data.debt_id,
      userId,
      "delete_debt",
    );
  },
} satisfies ToolHandlers;
