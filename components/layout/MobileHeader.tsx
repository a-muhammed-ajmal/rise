'use client';

import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface MobileHeaderProps {
  onMenuOpen: () => void;
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  const { signOut } = useAuth();

  return (
    <header className="sm:hidden h-12 bg-[#0A0A0A] border-b border-[#2A2A2A] flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40">
      <button
        onClick={onMenuOpen}
        className="w-12 h-12 -ml-3 flex items-center justify-center text-[#F0F0F0]"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      <span className="text-lg font-bold text-[#FF6B35] tracking-widest">RISE</span>

      <button
        onClick={signOut}
        className="w-12 h-12 -mr-3 flex items-center justify-center text-[#8A8A8A]"
        aria-label="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}
