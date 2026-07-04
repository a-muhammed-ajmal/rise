"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  DollarSign,
  Heart,
  Target,
  BarChart2,
  BookOpen,
  Users,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import { RiseLogo } from "@/components/brand/rise-logo";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// 5-slot layout: [Home][Tasks][AI-FAB (center)][Finance][More]
const LEFT_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/productivity", label: "Tasks", icon: CheckSquare },
] as const;

const RIGHT_ITEM = { href: "/finance", label: "Finance", icon: DollarSign };

const MORE_ITEMS = [
  { href: "/wellness", label: "Wellness", icon: Heart },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

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

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="nav-drawer h-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-[length:var(--text-label)] font-medium text-[var(--text-muted)]">
              All Modules
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "nav-drawer__item flex flex-col items-center justify-center gap-2 rounded-2xl p-4 min-h-[80px] tappable",
                    active && "nav-drawer__item--active",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-center leading-tight text-truncate w-full">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
