"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserId } from "@/lib/supabase/current-user";
import type { Project, ProjectCategory } from "@/lib/types/database";
import { loadProjects } from "@/lib/data/tasks";
import { isFreshSnapshot, type ServerSnapshot } from "@/lib/data/snapshot";

/** `initial` is a server-loaded snapshot, used only while fresh. */
export function useProjects(initial?: ServerSnapshot<Project[]> | null) {
  // Captured once: the snapshot only describes the first render.
  const [snapshot] = useState(initial);
  const [projects, setProjects] = useState<Project[]>(snapshot?.data ?? []);
  const [loading, setLoading] = useState(!snapshot);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const channelName = `projects-${id.replace(/:/g, "")}`;

  const fetchProjects = useCallback(async () => {
    try {
      setProjects(await loadProjects(createClient()));
      setError(null);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : String(queryError));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFreshSnapshot(snapshot)) fetchProjects();

    const supabase = createClient();
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProjects, channelName, snapshot]);

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
