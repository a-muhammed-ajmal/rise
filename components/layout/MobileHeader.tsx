'use client';

import Image from 'next/image';
import { Bell, Menu } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/lib/toast';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { user } = useAuth();
  const { permission, pendingCount, requestPermission } = useNotifications(user?.uid ?? '');

  const handleBellClick = async () => {
    if (permission === 'denied') {
      toast.error('Notifications are blocked. Enable them in your browser settings.');
      return;
    }
    if (permission !== 'granted') {
      const result = await requestPermission();
      if (result === 'granted') {
        toast.success('Notifications enabled! You\'ll be reminded about your actions and rhythms.');
      } else {
        toast.error('Notification permission denied.');
      }
      return;
    }
    if (pendingCount > 0) {
      toast.info(`You have ${pendingCount} pending action${pendingCount !== 1 ? 's' : ''} today.`);
    } else {
      toast.success('You\'re all caught up!');
    }
  };

  return (
    <header className="sm:hidden h-14 bg-[#0A0A0A] border-b border-[#2A2A2A] flex items-center justify-between px-3 fixed top-0 left-0 right-0 z-40">
      {/* Left: hamburger + logo + name */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="w-9 h-9 flex items-center justify-center text-[#8A8A8A] hover:text-[#F0F0F0] rounded-full hover:bg-[#1C1C1C] -ml-1"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-1.5">
          <Image
            src="/icons/icon-maskable-912.png"
            alt="RISE"
            width={22}
            height={22}
            priority
          />
          <span className="text-base font-bold text-[#FF9933] tracking-widest">RISE</span>
        </div>
      </div>

      {/* Right: notification bell */}
      <button
        type="button"
        onClick={handleBellClick}
        className="relative w-10 h-10 flex items-center justify-center text-[#8A8A8A] hover:text-[#F0F0F0] rounded-full hover:bg-[#1C1C1C] -mr-1"
        aria-label={
          permission === 'granted'
            ? `Notifications (${pendingCount} pending)`
            : 'Enable notifications'
        }
      >
        <Bell
          size={20}
          className={permission === 'granted' ? 'text-[#F0F0F0]' : 'text-[#8A8A8A]'}
        />
        {permission === 'granted' && pendingCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[#FF4F6D] flex items-center justify-center text-[10px] font-bold text-white leading-none">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
        {permission === 'default' && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF9933]" />
        )}
      </button>
    </header>
  );
}
