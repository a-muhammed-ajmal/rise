"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, LogOut, Settings } from "lucide-react";

interface TopbarProps {
  email?: string;
}

export function Topbar({ email }: TopbarProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = email ? email[0].toUpperCase() : "?";

  return (
    <header className="h-16 border-b border-border bg-card/80 glass-surface flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      {/* Mobile logo */}
      <Link href="/" className="flex items-center gap-2 md:hidden group">
        <div className="w-8 h-8 rounded-lg bg-mod-ai flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight">RISE</span>
      </Link>

      {/* Desktop: empty left */}
      <div className="hidden md:block" />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full h-9 w-9 inline-flex items-center justify-center cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
            {email}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push("/settings")}
            className="cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={signOut}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
