'use client';

import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function MobileHeader() {
  const { signOut } = useAuth();

  return (
    <header className="sm:hidden h-10 bg-[#0A0A0A] border-b border-[#2A2A2A] flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40">
      <span className="text-lg font-bold text-[#FF6B35] tracking-widest">RISE</span>

      <button
        type="button"
        onClick={signOut}
        className="w-10 h-10 -mr-2 flex items-center justify-center text-[#8A8A8A] hover:text-[#F0F0F0]"
        aria-label="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}
