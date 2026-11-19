import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO, subDays } from "date-fns";
import type {
  Contact,
  Database,
  Goal,
  Habit,
  HabitLog,
  JournalEntry,
  Json,
  Link,
  Note,
} from "@/lib/types/database";

// Initial-data loaders for the CRM, Goals, Knowledge, Wellness, Settings and
// Assistant pages. Each is shared by the server page and the client view's
// refetch, and throws on a query error so a failed server load falls back to
// the client fetch instead of rendering as an empty, "fresh" page.

type Client = SupabaseClient<Database>;

// ─── CRM ──────────────────────────────────────────────────────────────────────

export async function loadContacts(supabase: Client): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export type GoalsData = {
  goals: Goal[];
  entries: JournalEntry[];
  todayEntry: JournalEntry | null;
};

export async function loadGoalsData(
  supabase: Client,
  today: string,
): Promise<GoalsData> {
  const [goals, entries, todayEntry] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("journal_entries")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(30),
    supabase
      .from("journal_entries")
      .select("*")
      .is("deleted_at", null)
      .eq("date", today)
      .maybeSingle(),
  ]);
  if (goals.error) throw new Error(goals.error.message);
  if (entries.error) throw new Error(entries.error.message);
  if (todayEntry.error) throw new Error(todayEntry.error.message);
  return {
    goals: goals.data ?? [],
    entries: entries.data ?? [],
    todayEntry: todayEntry.data ?? null,
  };
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export type KnowledgeData = { notes: Note[]; links: Link[] };

export async function loadKnowledgeData(supabase: Client): Promise<KnowledgeData> {
  const [notes, links] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("links")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (notes.error) throw new Error(notes.error.message);
  if (links.error) throw new Error(links.error.message);
  return { notes: notes.data ?? [], links: links.data ?? [] };
}

// ─── Wellness ─────────────────────────────────────────────────────────────────

export type WellnessData = { habits: Habit[]; logs: HabitLog[] };

/** Active habits (by reminder time, untimed last) and the last 30 days of logs. */
export async function loadWellnessData(
  supabase: Client,
  today: string,
): Promise<WellnessData> {
  const last30 = format(subDays(parseISO(today), 30), "yyyy-MM-dd");
  const [habits, logs] = await Promise.all([
    supabase
      .from("habits")
      .select("*")
      .is("deleted_at", null)
      .eq("active", true)
      .order("reminder_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("habit_logs")
      .select("*")
      .is("deleted_at", null)
      .gte("logged_date", last30),
  ]);
  if (habits.error) throw new Error(habits.error.message);
  if (logs.error) throw new Error(logs.error.message);
  return { habits: habits.data ?? [], logs: logs.data ?? [] };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type ProfileData = {
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

/**
 * Deliberately getUser(), not getClaims(): this reads user_metadata, and the
 * JWT's copy only catches up with an updateUser() edit at the next token
 * refresh — up to an hour of showing the previous name or photo.
 */
export async function loadProfile(supabase: Client): Promise<ProfileData> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const user = data.user;
  if (!user) throw new Error("Not signed in");
  const meta: Record<string, unknown> = user.user_metadata ?? {};
  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  // A missing profile row is normal; a failed read falls back to the name on
  // the account rather than failing the page.
  if (profileError) console.error("[settings] profile load failed", profileError.message);
  return {
    email: user.email ?? null,
    displayName: profile?.display_name ?? metadataString(meta, "full_name") ?? "",
    avatarUrl: metadataString(meta, "avatar_url"),
  };
}

// ─── Assistant ────────────────────────────────────────────────────────────────

export type ConversationData = { id: string; messages: Json } | null;

/** The most recently updated conversation, or null when there is none yet. */
export async function loadLatestConversation(
  supabase: Client,
  userId: string,
): Promise<ConversationData> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, messages")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}
