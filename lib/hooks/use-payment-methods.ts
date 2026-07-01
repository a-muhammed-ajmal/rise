"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/lib/types/database";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentMethods = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) {
      toast.error("Failed to load payment methods");
      return;
    }
    setPaymentMethods(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  async function createPaymentMethod(data: {
    name: string;
    balance: number;
    color: string | null;
  }) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const maxOrder = paymentMethods.reduce(
      (max, m) => Math.max(max, m.display_order),
      -1
    );

    const { error } = await supabase.from("payment_methods").insert({
      user_id: user.id,
      name: data.name.trim(),
      balance: data.balance,
      color: data.color,
      is_active: true,
      display_order: maxOrder + 1,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("A wallet with that name already exists");
      } else {
        toast.error("Failed to create wallet");
      }
      return;
    }

    await fetchPaymentMethods();
  }

  async function updatePaymentMethod(
    id: string,
    updates: { name?: string; color?: string | null }
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("payment_methods")
      .update({
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.color !== undefined ? { color: updates.color } : {}),
      })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        toast.error("A wallet with that name already exists");
      } else {
        toast.error("Failed to update wallet");
      }
      return;
    }

    await fetchPaymentMethods();
  }

  async function setActiveStatus(id: string, isActive: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update wallet status");
      return;
    }

    await fetchPaymentMethods();
  }

  async function reorderPaymentMethods(orderedIds: string[]) {
    const supabase = createClient();
    try {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from("payment_methods")
            .update({ display_order: index })
            .eq("id", id)
        )
      );
      await fetchPaymentMethods();
    } catch {
      toast.error("Failed to reorder wallets");
    }
  }

  async function adjustBalance(
    id: string,
    currentBalance: number,
    targetBalance: number,
    reason: string
  ) {
    const delta = targetBalance - currentBalance;
    if (delta === 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "adjustment" as const,
      amount: delta,
      category: "Balance Adjustment",
      description: reason.trim() || null,
      date: todayISO(),
      payment_method_id: id,
      tags: [],
    });

    if (error) {
      toast.error("Failed to adjust balance");
      return;
    }

    await fetchPaymentMethods();
  }

  async function findOrCreateByName(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Case-insensitive lookup first to prevent duplicates
    const { data: existing } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", trimmed)
      .maybeSingle();

    if (existing) return existing.id;

    const maxOrder = paymentMethods.reduce(
      (max, m) => Math.max(max, m.display_order),
      -1
    );

    const { data: created, error } = await supabase
      .from("payment_methods")
      .insert({
        user_id: user.id,
        name: trimmed,
        balance: 0,
        color: null,
        is_active: true,
        display_order: maxOrder + 1,
      })
      .select("id")
      .single();

    if (error) {
      // Race condition: another insert with same name won — look it up again
      if (error.code === "23505") {
        const { data: retry } = await supabase
          .from("payment_methods")
          .select("id")
          .eq("user_id", user.id)
          .ilike("name", trimmed)
          .maybeSingle();
        return retry?.id ?? null;
      }
      toast.error("Failed to create wallet");
      return null;
    }

    await fetchPaymentMethods();
    return created.id;
  }

  return {
    paymentMethods,
    loading,
    refresh: fetchPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    setActiveStatus,
    reorderPaymentMethods,
    adjustBalance,
    findOrCreateByName,
  };
}
