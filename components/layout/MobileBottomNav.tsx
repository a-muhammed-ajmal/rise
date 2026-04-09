'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CheckSquare, Plus, Activity, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onFabClick: () => void;
  onMoreClick: () => void;
}

export function MobileBottomNav({ onFabClick, onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-[#2A2A2A] pb-safe">
      <div className="h-16 flex items-center">
        {/* Home */}
        <Link
          href="/"
          className={cn(
            'flex-1 h-full flex flex-col items-center justify-center gap-0.5 text-xs',
            isActive('/') ? 'text-[#FF6B35]' : 'text-[#8A8A8A]'
          )}
        >
          <Home size={22} />
          <span>Home</span>
        </Link>

        {/* Actions */}
        <Link
          href="/tasks"
          className={cn(
            'flex-1 h-full flex flex-col items-center justify-center gap-0.5 text-xs',
            isActive('/tasks') ? 'text-[#FF6B35]' : 'text-[#8A8A8A]'
          )}
        >
          <CheckSquare size={22} />
          <span>Actions</span>
        </Link>

        {/* FAB Center */}
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={onFabClick}
            className="w-14 h-14 bg-[#FF6B35] rounded-full flex items-center justify-center shadow-fab -mt-5 active:scale-95 transition-transform"
            aria-label="Quick create"
          >
            <Plus size={26} className="text-white" />
          </button>
        </div>

        {/* Wellness */}
        <Link
          href="/wellness"
          className={cn(
            'flex-1 h-full flex flex-col items-center justify-center gap-0.5 text-xs',
            isActive('/wellness') ? 'text-[#1ABC9C]' : 'text-[#8A8A8A]'
          )}
        >
          <Activity size={22} />
          <span>Wellness</span>
        </Link>

        {/* More */}
        <button
          onClick={onMoreClick}
          className="flex-1 h-full flex flex-col items-center justify-center gap-0.5 text-xs text-[#8A8A8A]"
        >
          <MoreHorizontal size={22} />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
