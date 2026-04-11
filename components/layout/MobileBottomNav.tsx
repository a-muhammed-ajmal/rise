'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CheckSquare, Eye, Wallet, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  const tabs: { href: string; label: string; icon: typeof Home }[] = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/tasks', label: 'Actions', icon: CheckSquare },
    { href: '/goals', label: 'Visions', icon: Eye },
    { href: '/finance', label: 'Finance', icon: Wallet },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-[#2A2A2A] pb-safe">
      <div className="h-12 flex items-stretch">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] min-w-0 px-0.5',
                active ? 'text-[#FF6B35]' : 'text-[#8A8A8A]'
              )}
            >
              {active && (
                <span
                  className="absolute top-0 left-2 right-2 h-0.5 rounded-full bg-[#FF6B35]"
                  aria-hidden
                />
              )}
              <Icon size={20} className={cn('shrink-0', active && 'text-[#FF6B35]')} />
              <span className="truncate max-w-full">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onMoreClick}
          className="relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] text-[#8A8A8A] min-w-0 px-0.5"
        >
          <MoreHorizontal size={20} className="shrink-0" />
          <span className="truncate max-w-full">More</span>
        </button>
      </div>
    </nav>
  );
}
