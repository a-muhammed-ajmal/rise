'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, CheckSquare, Target, Wallet, Menu, X,
  Briefcase, BookOpen, FileText, MessageSquare, Activity, LogOut, Users,
  Eye, Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';
import GlobalFab from './GlobalFab';
import ToastContainer from '@/components/ui/ToastContainer';

const mainTabs = [
  { href: '/',        icon: Home,        label: 'Home' },
  { href: '/tasks',   icon: CheckSquare, label: 'Actions' },
  { href: '/goals',   icon: Eye,         label: 'Visions' },
  { href: '/finance', icon: Wallet,      label: 'Finance' },
];

const moreLinks = [
  { href: '/wellness',       icon: Activity,      label: 'Wellness',       color: '#1ABC9C' },
  { href: '/professional',   icon: Briefcase,     label: 'Professional',   color: '#1E4AFF' },
  { href: '/relationships',  icon: Users,         label: 'Relationships',  color: '#FF4F6D' },
  { href: '/reviews',        icon: Compass,       label: 'Reviews',        color: '#FFD700' },
  { href: '/journal',        icon: BookOpen,       label: 'Journal',        color: '#800080' },
  { href: '/documents',      icon: FileText,      label: 'Documents',      color: '#8E95A9' },
  { href: '/chat',           icon: MessageSquare, label: 'AI Chat',        color: '#FF9933' },
];

const allLinks = [
  ...mainTabs.map(t => ({ ...t, color: undefined })),
  ...moreLinks,
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <div className="flex h-dvh overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-border bg-surface/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/10">
            <img src="/icon-512.png" alt="RISE" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-base font-bold text-text tracking-tight">RISE</h1>
            <p className="text-[11px] text-text-3">Realms · Targets · Actions</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {allLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150',
                  active
                    ? 'bg-rise/12 text-rise'
                    : 'text-text-2 hover:bg-white/[0.04] hover:text-text',
                )}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.6} />
                {link.label}
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-rise" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 m-3 mt-0">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rise/30 to-rise-dark/20 flex items-center justify-center text-rise text-xs font-bold ring-1 ring-rise/20">
              {user?.displayName?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-text truncate">{user?.displayName || 'Ajmal'}</p>
              <p className="text-[11px] text-text-3 truncate">{user?.email || ''}</p>
            </div>
            <button onClick={signOut} className="text-text-3 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-500/10">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-surface/80 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-white/10">
              <img src="/icon-512.png" alt="RISE" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-[15px] text-text tracking-tight">RISE</span>
          </div>
          <button onClick={signOut} className="text-text-3 hover:text-text p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <LogOut size={18} />
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-border pb-safe z-40">
        <div className="flex items-center justify-around h-16">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 transition-colors relative',
                  active ? 'text-rise' : 'text-text-3',
                )}
              >
                {active && (
                  <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-rise" />
                )}
                <Icon size={21} strokeWidth={active ? 2.2 : 1.5} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-w-[56px] py-1 transition-colors relative',
              moreOpen ? 'text-rise' : 'text-text-3',
            )}
          >
            <Menu size={21} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* Global FAB */}
      <GlobalFab />

      {/* More Drawer */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-surface-2 rounded-t-2xl animate-slide-up pb-safe shadow-sheet border-t border-white/[0.06]">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-white/10" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="font-semibold text-text text-[15px]">More</h3>
              <button onClick={() => setMoreOpen(false)} className="text-text-3 p-1 rounded-lg hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl transition-all',
                      active
                        ? 'bg-rise/10 text-rise'
                        : 'text-text-2 hover:bg-white/[0.04] active:bg-white/[0.06]',
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      active ? 'bg-rise/15' : 'bg-white/[0.04]',
                    )}>
                      <Icon size={20} style={{ color: active ? undefined : link.color }} />
                    </div>
                    <span className="text-[11px] font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Toast notifications */}
    <ToastContainer />
    </>
  );
}
