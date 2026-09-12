"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { todayISO } from "@/lib/format";

const MODULES = [
  { href: "/productivity", label: "Productivity", description: "Tasks, projects, kanban",          icon: CheckSquare, iconCls: "text-mod-tasks",    bgCls: "bg-mod-tasks-tint" },
  { href: "/finance",      label: "Finance",      description: "Transactions, budgets, wallets",   icon: DollarSign,  iconCls: "text-mod-finance",  bgCls: "bg-mod-finance-tint" },
  { href: "/wellness",     label: "Wellness",     description: "Habits, streaks, focus timer",     icon: Heart,       iconCls: "text-mod-wellness", bgCls: "bg-mod-wellness-tint" },
  { href: "/goals",        label: "Goals",        description: "Goals, milestones, journal",       icon: Target,      iconCls: "text-mod-goals",    bgCls: "bg-mod-goals-tint" },
  { href: "/crm",          label: "CRM",          description: "Contacts, pipeline, interactions", icon: Users,       iconCls: "text-mod-crm",      bgCls: "bg-mod-crm-tint" },
  { href: "/knowledge",    label: "Knowledge",    description: "Notes, links, documents",          icon: BookOpen,    iconCls: "text-mod-knowledge", bgCls: "bg-mod-knowledge-tint" },
  { href: "/assistant",    label: "AI Assistant", description: "Gemini chat with tool access",     icon: RiseLogo,    iconCls: "",                      bgCls: "bg-brand-tint" },
  { href: "/analytics",    label: "Analytics",    description: "Charts across all modules",        icon: BarChart2,   iconCls: "text-mod-tasks",    bgCls: "bg-mod-tasks-tint" },
];

const AVATAR_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [exporting, setExporting] = useState(false);
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushSubscription();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data, error }) => {
        if (error) {
          toast.error("Could not load profile");
          return;
        }
        const u = data.user;
        if (!u) return;
        setEmail(u.email ?? null);
        const meta = u.user_metadata ?? {};
        const { data: profile, error: profileError } = await supabase
          .from("user_profile")
          .select("display_name")
          .eq("user_id", u.id)
          .maybeSingle();
        if (profileError) console.error("[settings] profile load failed", profileError.message);
        setDisplayName(profile?.display_name ?? metadataString(meta, "full_name") ?? "");
        setAvatarUrl(metadataString(meta, "avatar_url"));
      });
  }, []);

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Could not sign out");
      return;
    }
    navigator.serviceWorker?.controller?.postMessage("CLEAR_PRIVATE_CACHES");
    router.push("/login");
    router.refresh();
  }

  async function saveProfile() {
    setSavingProfile(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setSavingProfile(false);
      toast.error("Could not identify your account");
      return;
    }
    const nextName = displayName.trim() || null;
    const { data: updatedProfiles, error: profileUpdateError } = await supabase
      .from("user_profile")
      .update({ display_name: nextName })
      .eq("user_id", user.id)
      .select("id");
    let profileError = profileUpdateError;
    if (!profileError && updatedProfiles?.length === 0) {
      const inserted = await supabase.from("user_profile").insert({
        user_id: user.id,
        display_name: nextName,
        facts: {},
      });
      profileError = inserted.error;
    }
    if (profileError) {
      setSavingProfile(false);
      toast.error("Failed to save name");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nextName },
    });
    setSavingProfile(false);
    if (error) { toast.error("Failed to save name"); return; }
    toast.success("Name saved");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = AVATAR_MIME_EXTENSIONS[file.type];
    if (!extension) {
      toast.error("Use a JPG, PNG, WebP, or GIF image");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Profile photos must be 5 MB or smaller");
      e.target.value = "";
      return;
    }
    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
       const oldPath = metadataString(user.user_metadata ?? {}, "avatar_path");
       const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) { toast.error("Upload failed — ensure the 'avatars' bucket exists in Supabase Storage"); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = urlData.publicUrl;
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_url: url, avatar_path: path },
      });
      if (metadataError) {
        await supabase.storage.from("avatars").remove([path]);
        toast.error("Could not save the new photo");
        return;
      }
      if (oldPath && oldPath !== path) {
        const { error: cleanupError } = await supabase.storage
          .from("avatars")
          .remove([oldPath]);
        if (cleanupError) console.error("[settings] old avatar cleanup failed", cleanupError.message);
      }
      setAvatarUrl(url);
      toast.success("Photo updated");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function exportData() {
    setExporting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("export_current_user_data");
      if (error || data === null) {
        console.error("[settings] export failed", error?.message);
        toast.error("Could not export your data");
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rise-export-${todayISO()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } finally {
      setExporting(false);
    }
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

          <div className="flex justify-between items-center">
            <Label className="text-sm font-normal text-muted-foreground">Locale</Label>
            <span className="text-sm font-medium">DD/MM/YYYY · 12-hour</span>
          </div>

          <div className="flex justify-between items-center">
            <Label className="text-sm font-normal text-muted-foreground">Time zone</Label>
            <span className="text-sm font-medium">Dubai (UTC+4)</span>
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
            Export all RISE records, including completed and recycled items, as JSON.
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
                <div className="rounded-md border p-2.5 space-y-1">
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
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/30 hover:bg-accent/50 transition-colors group"
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
