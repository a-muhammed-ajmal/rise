"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types/database";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: name.trim(), type })
      .select()
      .single();
    if (error || !data) return null;
    await fetchCategories();
    return data;
  }

  async function updateCategory(id: string, name: string): Promise<void> {
    const supabase = createClient();
    await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", id);
    await fetchCategories();
  }

  async function deleteCategory(id: string): Promise<void> {
    const supabase = createClient();
    await supabase.from("categories").delete().eq("id", id);
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
