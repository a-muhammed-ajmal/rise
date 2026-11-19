"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Category } from "@/lib/types/database";
import { loadCategories } from "@/lib/data/finance";
import { isFreshSnapshot, type ServerSnapshot } from "@/lib/data/snapshot";

/** `initial` is a server-loaded snapshot, used only while fresh. */
export function useCategories(initial?: ServerSnapshot<Category[]> | null) {
  // Captured once: the snapshot only describes the first render.
  const [snapshot] = useState(initial);
  const [categories, setCategories] = useState<Category[]>(snapshot?.data ?? []);
  const [loading, setLoading] = useState(!snapshot);

  const fetchCategories = useCallback(async () => {
    try {
      setCategories(await loadCategories(createClient()));
    } catch (error) {
      console.error(
        "[use-categories] fetch failed",
        error instanceof Error ? error.message : error,
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFreshSnapshot(snapshot)) fetchCategories();
  }, [fetchCategories, snapshot]);

  async function createCategory(
    name: string,
    type: "income" | "expense"
  ): Promise<Category | null> {
    const supabase = createClient();
    const userId = await currentUserId();
    if (!userId) return null;
    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name: name.trim(), type })
      .select()
      .single();
    if (error || !data) return null;
    await fetchCategories();
    return data;
  }

  async function updateCategory(id: string, name: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchCategories();
  }

  async function deleteCategory(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await fetchCategories();
  }

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
