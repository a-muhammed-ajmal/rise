"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Project, ProjectCategory } from "@/lib/types/database";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const channelName = `projects-${id.replace(/:/g, "")}`;

  const fetchProjects = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("projects")
      .select("*")
      .is("deleted_at", null)
      .eq("status", "active")
      .order("name");
    if (queryError) {
      setError(queryError.message);
    } else {
      setProjects(data ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();

    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProjects, channelName]);

  async function createProject(
    name: string,
    color: string,
    description?: string | null,
    category: ProjectCategory = "default",
  ) {
    const supabase = createClient();
    const userId = await currentUserId();
    if (!userId) return;
    const { error: insertError } = await supabase.from("projects").insert({
      user_id: userId,
      name,
      description: description ?? null,
      status: "active",
      color,
      category,
    });
    if (insertError) throw new Error(insertError.message);
    await fetchProjects();
  }

  async function updateProject(id: string, updates: Partial<Project>) {
    const supabase = createClient();
    const { id: _id, created_at: _c, updated_at: _u, user_id: _uid, ...safeUpdates } = updates;
    const { error: updateError } = await supabase
      .from("projects")
      .update(safeUpdates)
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);
    await fetchProjects();
  }

  async function deleteProject(id: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (deleteError) throw new Error(deleteError.message);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: fetchProjects,
  };
}
