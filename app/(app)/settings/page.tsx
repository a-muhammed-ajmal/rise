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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SettingsPage() {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
      <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2 animate-rise-in stagger-1">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
        Settings
      </h1>

      {/* Account */}
      <Card className="animate-rise-in stagger-2">
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
      <Card className="animate-rise-in stagger-3">
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
      <Card className="animate-rise-in stagger-4">
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

      {/* AI Safety */}
      <Card className="animate-rise-in stagger-4">
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

      <p className="text-xs text-center text-muted-foreground animate-rise-in stagger-4">
        RISE v0.1.0 — Personal OS
      </p>
    </div>
  );
}
