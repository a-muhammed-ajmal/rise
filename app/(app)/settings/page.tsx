"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
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

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } = usePushSubscription();

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function exportData() {
    setExporting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    const payload = {
      exported_at: new Date().toISOString(),
      tasks: tasks ?? [],
      transactions: transactions ?? [],
      habits: habits ?? [],
      goals: goals ?? [],
      contacts: contacts ?? [],
      notes: notes ?? [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rise-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success("Data exported");
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-h1 font-heading tracking-tight flex items-center gap-2 slide-up stagger-1">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
        Settings
      </h1>

      {/* Account */}
      <Card className="slide-up stagger-2">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{email ?? "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Account type</span>
            <Badge variant="secondary">Personal</Badge>
          </div>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="slide-up stagger-3">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Currency</span>
            <span className="text-sm font-medium">AED (UAE Dirham)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Date format</span>
            <span className="text-sm font-medium">DD/MM/YYYY</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Time format</span>
            <span className="text-sm font-medium">12-hour (AM/PM)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Appearance</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggle}
              className="gap-2 min-w-28"
            >
              {theme === "dark" ? (
                <>
                  <Moon className="w-4 h-4" /> Dark mode
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4" /> Light mode
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="slide-up stagger-4">
        <CardHeader>
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

      {/* Notifications */}
      <Card className="slide-up stagger-4">
        <CardHeader>
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
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Safety */}
      <Card className="slide-up stagger-4">
        <CardHeader>
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

      {/* Modules */}
      <Card className="slide-up stagger-4">
        <CardHeader>
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

      {/* About */}
      <Card className="slide-up stagger-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" /> About RISE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
