'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, CheckSquare, Target, Wallet, Menu, X,
  Briefcase, BookOpen, FileText, MessageSquare, Activity, Settings, LogOut, Users,
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
  { href: '/journal',        icon: BookOpen,      label: 'Journal',        color: '#800080' },
  { href: '/documents',      icon: FileText,      label: 'Documents',      color: '#94A3B8' },
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
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-[#0D0D14]/90 backdrop-blur-sm p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
            <img src="/icon-512.png" alt="RISE" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-semibold text-text">RISE</h1>
            <p className="text-xs text-text-3">Realms · Targets · Actions</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5">
          {allLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  isActive(link.href)
                    ? 'bg-rise/15 text-rise border-l-2 border-rise rounded-r-xl'
                    : 'rounded-xl text-text-2 hover:bg-white/5 hover:text-text',
                )}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-rise/20 flex items-center justify-center text-rise text-sm font-semibold">
              {user?.displayName?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{user?.displayName || 'Ajmal'}</p>
              <p className="text-xs text-text-3 truncate">{user?.email || ''}</p>
            </div>
            <button onClick={signOut} className="text-text-3 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-[#0D0D14]/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/icon-512.png" alt="RISE" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-text">RISE</span>
          </div>
          <button onClick={signOut} className="text-text-3 hover:text-text">
            <Settings size={20} />
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0D0D14]/95 backdrop-blur-[12px] border-t border-border pb-safe z-40">
        <div className="flex items-center justify-around h-16">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 border-t-2 transition-colors',
                  isActive(tab.href) ? 'text-rise border-rise' : 'text-text-3 border-transparent',
                )}
              >
                <Icon size={22} strokeWidth={isActive(tab.href) ? 2.5 : 1.5} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 border-t-2 transition-colors',
              moreOpen ? 'text-rise border-rise' : 'text-text-3 border-transparent',
            )}
          >
            <Menu size={22} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* Global FAB */}
      <GlobalFab />

      {/* More Drawer */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-[#111118] rounded-t-3xl animate-slide-up pb-safe shadow-sheet border-t border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold text-text">More</h3>
              <button onClick={() => setMoreOpen(false)} className="text-text-3"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors',
                      isActive(link.href) ? 'bg-rise/15 text-rise' : 'text-text-2 hover:bg-white/5',
                    )}
                  >
                    <Icon size={24} style={{ color: isActive(link.href) ? undefined : link.color }} />
                    <span className="text-xs font-medium">{link.label}</span>
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
