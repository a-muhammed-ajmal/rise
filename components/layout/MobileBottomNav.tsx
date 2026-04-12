'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onPlusClick: () => void;
  plusOpen?: boolean;
}

export function MobileBottomNav({ onPlusClick, plusOpen = false }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0A0A] border-t border-[#2A2A2A] pb-safe">
      <div className="h-16 flex items-center justify-around px-4">
        {/* Home */}
        <Link
          href="/"
          className={cn(
            'flex flex-col items-center justify-center gap-1 w-12',
            pathname === '/' ? 'text-[#FF6B35]' : 'text-[#8A8A8A]'
          )}
          aria-label="Home"
        >
          <Home size={22} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Global add button — centered, elevated */}
        <button
          type="button"
          onClick={onPlusClick}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center shadow-fab',
            'active:scale-95 transition-transform',
            plusOpen ? 'bg-[#CC4F1E]' : 'bg-[#FF6B35]'
          )}
          aria-label={plusOpen ? 'Close quick create' : 'Quick create'}
          aria-expanded={plusOpen ? 'true' : 'false'}
        >
          <Plus
            size={26}
            className={cn('text-white transition-transform duration-200 ease-out', plusOpen && 'rotate-45')}
          />
        </button>

        {/* AI Chat */}
        <Link
          href="/chat"
          className={cn(
            'flex flex-col items-center justify-center gap-1 w-12',
            pathname === '/chat' ? 'text-[#FF9933]' : 'text-[#8A8A8A]'
          )}
          aria-label="AI Chat"
        >
          <MessageSquare size={22} />
          <span className="text-[10px] font-medium">AI Chat</span>
        </Link>
      </div>
    </nav>
  );
}
