"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-56 h-screen border-r border-border bg-card/80 glass-surface sticky top-0 shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-mod-ai flex items-center justify-center shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block font-bold text-lg tracking-tight">
            RISE
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Tooltip key={href}>
              <TooltipTrigger className="w-full">
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="hidden lg:block">{label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="lg:hidden">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
