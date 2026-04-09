'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, CheckSquare, Eye, Wallet, Activity, Briefcase,
  Users, Compass, BookOpen, FileText, MessageSquare, LogOut, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';

const NAV_LINKS = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/tasks', icon: CheckSquare, label: 'Actions' },
  { href: '/goals', icon: Eye, label: 'Visions' },
  { href: '/finance', icon: Wallet, label: 'Finance' },
  { href: '/wellness', icon: Activity, label: 'Wellness', accent: '#1ABC9C' },
  { href: '/professional', icon: Briefcase, label: 'Professional', accent: '#1E4AFF' },
  { href: '/relationships', icon: Users, label: 'Relationships', accent: '#FF4F6D' },
  { href: '/reviews', icon: Compass, label: 'Reviews', accent: '#FFD700' },
  { href: '/journal', icon: BookOpen, label: 'Journal', accent: '#800080' },
  { href: '/documents', icon: FileText, label: 'Documents', accent: '#8E95A9' },
  { href: '/chat', icon: MessageSquare, label: 'AI Chat', accent: '#FF9933' },
];

interface MobileSidebarDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebarDrawer({ open, onClose }: MobileSidebarDrawerProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity sm:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[280px] bg-[#0A0A0A] border-r border-[#2A2A2A] flex flex-col transition-transform duration-250 sm:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#2A2A2A]">
          <span className="text-xl font-bold text-[#FF6B35] tracking-widest">RISE</span>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-[#8A8A8A]"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_LINKS.map(({ href, icon: Icon, label, accent }) => {
            const active = pathname === href;
            const color = accent ?? '#FF6B35';
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm transition-colors relative min-h-[48px]',
                  active
                    ? 'text-[#F0F0F0] bg-[#1C1C1C]'
                    : 'text-[#8A8A8A] hover:text-[#F0F0F0]'
                )}
              >
                <Icon size={20} style={{ color: active ? color : undefined }} />
                <span>{label}</span>
                {active && (
                  <span
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full"
                    style={{ backgroundColor: color }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        {user && (
          <div className="border-t border-[#2A2A2A] p-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={user.displayName ?? user.email ?? 'U'}
                photoURL={user.photoURL}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F0F0F0] truncate">
                  {user.displayName ?? 'User'}
                </p>
                <p className="text-xs text-[#8A8A8A] truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="mt-3 w-full flex items-center gap-2 text-sm text-[#FF4F6D] py-2"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
