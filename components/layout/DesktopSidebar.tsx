'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  CheckSquare,
  Eye,
  Wallet,
  Activity,
  Briefcase,
  Users,
  Compass,
  BookOpen,
  FileText,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';

const NAV_LINKS = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/tasks', icon: CheckSquare, label: 'Actions' },
  { href: '/goals', icon: Eye, label: 'Visions' },
  { href: '/finance', icon: Wallet, label: 'Finance' },
  { href: '/wellness', icon: Activity, label: 'Wellness' },
  { href: '/professional', icon: Briefcase, label: 'Professional' },
  { href: '/relationships', icon: Users, label: 'Relationships' },
  { href: '/reviews', icon: Compass, label: 'Reviews' },
  { href: '/journal', icon: BookOpen, label: 'Journal' },
  { href: '/documents', icon: FileText, label: 'Documents' },
  { href: '/chat', icon: MessageSquare, label: 'AI Chat' },
];

const ORANGE = '#FF9933';

export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="hidden sm:flex flex-col w-[200px] h-screen fixed left-0 top-0 bg-[#0A0A0A] border-r border-[#2A2A2A] z-30">
      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <Image
            src="/icons/icon-maskable-912.png"
            alt="RISE"
            width={26}
            height={26}
            className="flex-shrink-0"
            priority
          />
          <span className="text-base font-bold text-[#FF9933] tracking-widest">RISE</span>
        </div>
        <p className="text-[10px] text-[#505050] mt-0.5 leading-tight">
          Realms · Targets · Actions
        </p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_LINKS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative',
                active
                  ? 'text-[#F0F0F0] bg-[#FF9933]/12'
                  : 'text-[#8A8A8A] hover:text-[#F0F0F0] hover:bg-[#141414]'
              )}
            >
              <Icon
                size={18}
                className={cn(active ? 'text-[#FF9933]' : 'text-[#8A8A8A]')}
              />
              <span>{label}</span>
              {active && (
                <span
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-l-full bg-[#FF9933]"
                  style={{ boxShadow: `0 0 8px ${ORANGE}` }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      {user && (
        <div className="border-t border-[#2A2A2A] p-3">
          <div className="flex items-center gap-2">
            <Avatar
              name={user.displayName ?? user.email ?? 'U'}
              photoURL={user.photoURL}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#F0F0F0] truncate">
                {user.displayName ?? 'User'}
              </p>
              <p className="text-[10px] text-[#8A8A8A] truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-[#8A8A8A] hover:text-[#FF4F6D] p-1"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
