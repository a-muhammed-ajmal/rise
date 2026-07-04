"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types/database";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("name");
    setProjects(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function createProject(name: string, color: string, description?: string | null) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("projects").insert({
      user_id: user.id,
      name,
      description: description ?? null,
      status: "active",
      color,
    });
    await fetchProjects();
  }

  async function updateProject(id: string, updates: Partial<Project>) {
    const supabase = createClient();
    const { id: _id, created_at: _c, updated_at: _u, user_id: _uid, ...safeUpdates } = updates;
    await supabase.from("projects").update(safeUpdates).eq("id", id);
    await fetchProjects();
  }

  async function deleteProject(id: string) {
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return { projects, loading, createProject, updateProject, deleteProject, refresh: fetchProjects };
}
