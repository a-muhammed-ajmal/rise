"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const mobileItems = navItems.filter((i) => i.mobile);
const moreItems = navItems.filter((i) => !i.mobile);

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-card/85 glass-surface border-t border-border flex items-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== ("/" as string) && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors min-h-[44px]",
                active ? "text-mod-ai" : "text-muted-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-mod-ai"
                />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  active && "scale-110",
                )}
              />
              <span className={cn("truncate", active && "font-medium")}>{label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground min-h-[44px]"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* More drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 pb-4">
            {moreItems.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === (href as string) ||
                pathname.startsWith(href as string);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-sm font-medium transition-colors min-h-[80px]",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground hover:bg-accent/80",
                  )}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-center leading-tight">{label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
