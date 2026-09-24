"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Category } from "@/lib/types/database";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      console.error("[use-categories] fetch failed", error.message);
      setLoading(false);
      return;
    }
    setCategories(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
