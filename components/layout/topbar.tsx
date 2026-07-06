"use client";

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/hooks/use-theme";

interface TopbarProps {
  email?: string;
  fullName?: string;
  avatarUrl?: string;
}

export function Topbar({ email, fullName, avatarUrl }: TopbarProps) {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = fullName || email || "";
  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (email?.[0]?.toUpperCase() ?? "?");

  return (
    <header className="h-14 border-b border-border bg-background/90 backdrop-blur-xl flex items-center justify-between px-4 md:px-5 sticky top-0 z-40">
      {/* Mobile logo */}
      <Link href="/" className="flex items-center gap-2 md:hidden group">
        <Image
          src="/icon-192.png"
          alt="RISE"
          width={28}
          height={28}
          className="rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-105"
        />
        <span className="font-heading font-semibold text-base tracking-tight">RISE</span>
      </Link>

      {/* Desktop: empty left */}
      <div className="hidden md:block" />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggle}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border-[1.5px] border-border hover:border-[rgba(255,101,53,0.50)] hover:bg-accent active:scale-95 transition-all"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Moon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full h-9 w-9 inline-flex items-center justify-center cursor-pointer" aria-label="User menu">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              {fullName && (
                <p className="text-sm font-medium truncate">{fullName}</p>
              )}
              <p className="text-xs text-muted-foreground truncate">{email}</p>
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
      </div>
    </header>
  );
}
