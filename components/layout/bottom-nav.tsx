"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  DollarSign,
  Heart,
  Target,
  BarChart2,
  BookOpen,
  Users,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import { RiseLogo } from "@/components/brand/rise-logo";
import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

// 5-slot layout: [Home][Tasks][AI-FAB (center)][Finance][More]
const LEFT_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/productivity", label: "Tasks", icon: CheckSquare },
] as const;

const RIGHT_ITEM = { href: "/finance", label: "Finance", icon: DollarSign };

type MoreItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeColor: string;
};

const MORE_ITEMS: MoreItem[] = [
  { href: "/projects",  label: "Projects",  icon: FolderOpen, badgeBg: "var(--mod-tasks-tint)",     badgeColor: "var(--mod-tasks)"     },
  { href: "/wellness",  label: "Wellness",  icon: Heart,      badgeBg: "var(--mod-wellness-tint)",  badgeColor: "var(--mod-wellness)"  },
  { href: "/goals",     label: "Goals",     icon: Target,     badgeBg: "var(--mod-goals-tint)",     badgeColor: "var(--mod-goals)"     },
  { href: "/analytics", label: "Analytics", icon: BarChart2,  badgeBg: "var(--brand-tint)",         badgeColor: "var(--brand-text)"    },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen,   badgeBg: "var(--mod-knowledge-tint)", badgeColor: "var(--mod-knowledge)" },
  { href: "/crm",       label: "CRM",       icon: Users,      badgeBg: "var(--mod-crm-tint)",       badgeColor: "var(--mod-crm)"       },
  { href: "/settings",  label: "Settings",  icon: Settings,   badgeBg: "var(--surface-paper)",      badgeColor: "var(--text-muted)"    },
];

function NavItem({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  pathname: string;
}) {
  const active =
    pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        "bottom-nav__item relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] tappable",
        active ? "text-brand-text" : "text-[var(--text-muted)]",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-brand"
        />
      )}
      <Icon className={cn("w-5 h-5", active && "scale-110")} />
      <span className={cn("text-truncate max-w-[52px]", active && "font-medium")}>
        {label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const aiActive = isActive("/assistant");

  return (
    <>
      <nav
        aria-label="Primary navigation"
        className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center overflow-visible"
      >
        {LEFT_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} pathname={pathname} />
        ))}

        {/* Center AI Compose FAB — protrudes 20px above nav bar */}
        <div className="flex-none flex items-center justify-center w-[72px]">
          <Link
            href="/assistant"
            aria-label="AI Compose"
            className={cn(
              "bottom-nav__fab flex items-center justify-center w-[52px] h-[52px] rounded-full tappable",
              aiActive && "bottom-nav__fab--active",
            )}
          >
            <RiseLogo mono className="w-6 h-6 bee-float" />
          </Link>
        </div>

        <NavItem {...RIGHT_ITEM} pathname={pathname} />

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="bottom-nav__item flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] tappable text-[var(--text-muted)]"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Floating card More menu */}
      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className="fixed inset-0 z-50 bg-[var(--surface-overlay)] supports-backdrop-filter:backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
          />
          <DialogPrimitive.Popup
            aria-label="All modules"
            className="more-menu-popup fixed left-3 right-3 z-50 rounded-2xl border border-border bg-popover shadow-popup overflow-hidden transition duration-200 ease-in-out data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <DialogPrimitive.Title className="font-semibold text-sm text-foreground">
                All Modules
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                render={
                  <button
                    aria-label="Close"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  />
                }
              >
                <X className="w-4 h-4" />
              </DialogPrimitive.Close>
            </div>

            {/* 4-column module grid */}
            <div className="grid grid-cols-4 gap-1.5 px-3 pb-3">
              {MORE_ITEMS.map(({ href, label, icon: Icon, badgeBg, badgeColor }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "nav-drawer__item flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 px-1 h-[68px] tappable",
                      active && "nav-drawer__item--active",
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={active ? undefined : { background: badgeBg }}
                    >
                      <Icon
                        className="w-[17px] h-[17px]"
                        style={active ? undefined : { color: badgeColor }}
                      />
                    </div>
                    <span className="text-center leading-tight w-full text-[length:var(--text-micro)]">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
