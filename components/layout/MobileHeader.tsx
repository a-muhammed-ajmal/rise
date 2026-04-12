'use client';

import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function MobileHeader() {
  const { signOut } = useAuth();

  return (
    <header className="sm:hidden h-10 bg-[#0A0A0A] border-b border-[#2A2A2A] flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center gap-2">
        <Image
          src="/icons/icon-maskable-912.png"
          alt="RISE"
          width={24}
          height={24}
          priority
        />
        <span className="text-lg font-bold text-[#FF9933] tracking-widest">RISE</span>
      </div>

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
