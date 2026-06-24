import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Palette, Settings } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2 animate-rise-in stagger-1">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
        Settings
      </h1>

      <Card className="animate-rise-in stagger-2">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Account type</span>
            <Badge variant="secondary">Personal</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-rise-in stagger-3">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
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
        </CardContent>
      </Card>

      <Card className="animate-rise-in stagger-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" /> AI Safety
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The AI assistant requires your approval before deleting data,
            converting leads, or making bulk changes. All writes are logged and
            reversible where possible.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        RISE v0.1.0 — Personal OS
      </p>
    </div>
  );
}
