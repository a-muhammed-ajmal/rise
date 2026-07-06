"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/lib/hooks/use-theme";
import {
  User,
  Shield,
  Palette,
  Settings,
  Sun,
  Moon,
  Download,
  LogOut,
  Bell,
  BellOff,
  CheckSquare,
  Heart,
  DollarSign,
  Target,
  Users,
  BookOpen,
  BarChart2,
  Info,
  Camera,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RiseLogo } from "@/components/brand/rise-logo";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePushSubscription } from "@/lib/hooks/use-push-subscription";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MODULES = [
  { href: "/productivity", label: "Productivity", description: "Tasks, projects, kanban",          icon: CheckSquare, iconCls: "text-mod-tasks",    bgCls: "bg-mod-tasks-tint" },
  { href: "/finance",      label: "Finance",      description: "Transactions, budgets, wallets",   icon: DollarSign,  iconCls: "text-mod-finance",  bgCls: "bg-mod-finance-tint" },
  { href: "/wellness",     label: "Wellness",     description: "Habits, streaks, focus timer",     icon: Heart,       iconCls: "text-mod-wellness", bgCls: "bg-mod-wellness-tint" },
  { href: "/goals",        label: "Goals",        description: "Goals, milestones, journal",       icon: Target,      iconCls: "text-mod-goals",    bgCls: "bg-mod-goals-tint" },
  { href: "/crm",          label: "CRM",          description: "Contacts, pipeline, interactions", icon: Users,       iconCls: "text-mod-crm",      bgCls: "bg-mod-crm-tint" },
  { href: "/knowledge",    label: "Knowledge",    description: "Notes, links, documents",          icon: BookOpen,    iconCls: "text-mod-knowledge", bgCls: "bg-mod-knowledge-tint" },
  { href: "/assistant",    label: "AI Assistant", description: "Gemini chat with tool access",     icon: RiseLogo,    iconCls: "",                      bgCls: "bg-brand-tint" },
  { href: "/analytics",    label: "Analytics",    description: "Charts across all modules",        icon: BarChart2,   iconCls: "text-mod-tasks",    bgCls: "bg-mod-tasks-tint" },
] as const;

type Prefs = {
  timeFormat: "12h" | "24h";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timezone: string;
  weekStart: "sunday" | "monday" | "saturday";
};

const DEFAULT_PREFS: Prefs = {
  timeFormat: "12h",
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Dubai",
  weekStart: "sunday",
};

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [exporting, setExporting] = useState(false);
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushSubscription();

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u) return;
        setEmail(u.email ?? null);
        const meta = u.user_metadata ?? {};
        setDisplayName((meta.full_name as string | undefined) ?? "");
        setAvatarUrl((meta.avatar_url as string | undefined) ?? null);
        const stored = meta.preferences as Partial<Prefs> | undefined;
        if (stored) setPrefs({ ...DEFAULT_PREFS, ...stored });
      });
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function saveProfile() {
    setSavingProfile(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() || null },
    });
    setSavingProfile(false);
    if (error) { toast.error("Failed to save name"); return; }
    toast.success("Name saved");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/avatar-${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) { toast.error("Upload failed — ensure the 'avatars' bucket exists in Supabase Storage"); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = urlData.publicUrl;
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      setAvatarUrl(url);
      toast.success("Photo updated");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    setSavingPrefs(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { preferences: next } });
    setSavingPrefs(false);
    if (error) { toast.error("Failed to save preferences"); return; }
    toast.success("Preferences saved");
  }

  async function exportData() {
    setExporting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [
      { data: tasks },
      { data: transactions },
      { data: habits },
      { data: goals },
      { data: contacts },
      { data: notes },
    ] = await Promise.all([
      supabase.from("tasks").select("*").neq("status", "done"),
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("habits").select("*").eq("active", true),
      supabase.from("goals").select("*"),
      supabase.from("contacts").select("*").order("name"),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
    ]);

    const blob = new Blob(
      [JSON.stringify({ exported_at: new Date().toISOString(), tasks, transactions, habits, goals, contacts, notes }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rise-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success("Data exported");
  }

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (email?.[0]?.toUpperCase() ?? "?");

  return (
    <div className="p-3 md:p-5 max-w-2xl space-y-5">
      <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2 slide-up stagger-1">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
        Settings
      </h1>

      {/* ── Profile ───────────────────────────────────────────── */}
      <Card className="slide-up stagger-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || "Avatar"} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label="Change photo"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                aria-label="Upload profile photo"
                className="sr-only"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName || email || "—"}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                onClick={saveProfile}
                disabled={savingProfile}
                className="shrink-0"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          {/* Account type + sign out */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Account type</p>
              <Badge variant="secondary" className="mt-0.5">Personal</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Preferences ───────────────────────────────────────── */}
      <Card className="slide-up stagger-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" /> Preferences
            {savingPrefs && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Appearance */}
          <div className="flex justify-between items-center">
            <Label className="text-sm font-normal text-muted-foreground">Appearance</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggle}
              className="gap-2 min-w-28"
            >
              {theme === "dark" ? (
                <><Moon className="w-4 h-4" /> Dark mode</>
              ) : (
                <><Sun className="w-4 h-4" /> Light mode</>
              )}
            </Button>
          </div>

          {/* Time format */}
          <div className="flex justify-between items-center gap-3">
            <Label htmlFor="time-format" className="text-sm font-normal text-muted-foreground shrink-0">
              Time format
            </Label>
            <Select
              value={prefs.timeFormat}
              onValueChange={(v) => v && savePrefs({ ...prefs, timeFormat: v as Prefs["timeFormat"] })}
            >
              <SelectTrigger id="time-format" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date format */}
          <div className="flex justify-between items-center gap-3">
            <Label htmlFor="date-format" className="text-sm font-normal text-muted-foreground shrink-0">
              Date format
            </Label>
            <Select
              value={prefs.dateFormat}
              onValueChange={(v) => v && savePrefs({ ...prefs, dateFormat: v as Prefs["dateFormat"] })}
            >
              <SelectTrigger id="date-format" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="flex justify-between items-center gap-3">
            <Label htmlFor="timezone" className="text-sm font-normal text-muted-foreground shrink-0">
              Timezone
            </Label>
            <Select
              value={prefs.timezone}
              onValueChange={(v) => v && savePrefs({ ...prefs, timezone: v })}
            >
              <SelectTrigger id="timezone" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Dubai">Dubai (UTC+4)</SelectItem>
                <SelectItem value="Asia/Riyadh">Riyadh (UTC+3)</SelectItem>
                <SelectItem value="Asia/Kolkata">India (UTC+5:30)</SelectItem>
                <SelectItem value="Europe/London">London (UTC+0/+1)</SelectItem>
                <SelectItem value="America/New_York">New York (UTC-5/-4)</SelectItem>
                <SelectItem value="America/Los_Angeles">Los Angeles (UTC-8/-7)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Week starts */}
          <div className="flex justify-between items-center gap-3">
            <Label htmlFor="week-start" className="text-sm font-normal text-muted-foreground shrink-0">
              Week starts
            </Label>
            <Select
              value={prefs.weekStart}
              onValueChange={(v) => v && savePrefs({ ...prefs, weekStart: v as Prefs["weekStart"] })}
            >
              <SelectTrigger id="week-start" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
                <SelectItem value="saturday">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency (fixed) */}
          <div className="flex justify-between items-center">
            <Label className="text-sm font-normal text-muted-foreground">Currency</Label>
            <span className="text-sm font-medium">AED (UAE Dirham)</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Data ──────────────────────────────────────────────── */}
      <Card className="slide-up stagger-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Export all your tasks, transactions, habits, goals, contacts and notes as JSON.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={exportData}
            disabled={exporting}
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Export all data"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Notifications ─────────────────────────────────────── */}
      <Card className="slide-up stagger-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {permission === "unsupported" ? (
            <p className="text-sm text-muted-foreground">
              Push notifications are not supported in this browser.
            </p>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">Push notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {permission === "denied"
                      ? "Blocked — allow in browser settings"
                      : subscribed
                        ? "Active — receiving habit nudges & follow-up reminders"
                        : "Off — enable to get reminders"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={subscribed ? "outline" : "default"}
                  size="sm"
                  className="gap-2 min-w-28"
                  disabled={pushLoading || permission === "denied"}
                  onClick={subscribed ? unsubscribe : subscribe}
                >
                  {subscribed ? (
                    <><BellOff className="w-4 h-4" /> Disable</>
                  ) : (
                    <><Bell className="w-4 h-4" /> Enable</>
                  )}
                </Button>
              </div>
              {subscribed && (
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active reminders</p>
                  <p className="text-sm">✅ Habit nudges</p>
                  <p className="text-sm">✅ CRM follow-ups</p>
                  <p className="text-sm">✅ Daily digest (11:59 PM)</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── AI Safety ─────────────────────────────────────────── */}
      <Card className="slide-up stagger-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" /> AI Safety
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The AI assistant requires your approval before deleting data, converting leads, or making
            bulk changes. All writes are logged and reversible where possible.
          </p>
        </CardContent>
      </Card>

      {/* ── Modules ───────────────────────────────────────────── */}
      <Card className="slide-up stagger-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4" /> Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/50 transition-colors group"
                >
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", mod.bgCls)}>
                    <Icon className={cn("w-3.5 h-3.5", mod.iconCls)} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">{mod.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{mod.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── About ─────────────────────────────────────────────── */}
      <Card className="slide-up stagger-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" /> About RISE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Version</span>
            <Badge variant="secondary">v0.1.0</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">AI Model</span>
            <span className="text-sm font-medium">Gemini 2.5 Flash</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Database</span>
            <span className="text-sm font-medium">Supabase Postgres</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Hosting</span>
            <span className="text-sm font-medium">Vercel</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t border-border">
            RISE is a single-user personal operating system. Your data is private, stored in your own Supabase project, and never shared.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground slide-up stagger-4 pb-2">
        RISE v0.1.0 — Personal OS
      </p>
    </div>
  );
}
