'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileSidebarDrawer } from './MobileSidebarDrawer';
import { MoreSheet } from './MoreSheet';
import { DesktopSidebar } from './DesktopSidebar';
import { QuickCreateSheet, DesktopFab } from './GlobalFab';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { PWAInstallPrompt } from '@/components/providers/PWAInstallPrompt';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const router = useRouter();

  const handleQuickAction = (label: string) => {
    setFabOpen(false);
    // Navigate to the relevant page — modals will be triggered by URL state
    // or the page itself. For now, navigate to the relevant page.
    const routes: Record<string, string> = {
      Action: '/tasks?create=true',
      Lead: '/professional?tab=leads&create=true',
      Deal: '/professional?tab=deals&create=true',
      Connection: '/relationships?create=true',
      Income: '/finance?create=income',
      Expense: '/finance?create=expense',
      Rhythm: '/wellness?create=true',
      Document: '/documents?create=true',
    };
    if (routes[label]) router.push(routes[label]);
  };

  return (
    <div className="min-h-dvh bg-[#0A0A0A]">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Mobile Header */}
      <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />

      {/* Mobile Sidebar Drawer */}
      <MobileSidebarDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* More Sheet */}
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      {/* Quick Create Sheet */}
      <QuickCreateSheet
        open={fabOpen}
        onClose={() => setFabOpen(false)}
        onAction={handleQuickAction}
      />

      {/* Desktop FAB */}
      <DesktopFab onClick={() => setFabOpen(true)} />

      {/* Main Content */}
      <main
        className="
          pt-12 pb-[80px] min-h-dvh
          sm:pt-0 sm:pb-0 sm:pl-[200px]
        "
      >
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav
        onFabClick={() => setFabOpen(true)}
        onMoreClick={() => setMoreOpen(true)}
      />

      {/* Toasts */}
      <ToastContainer />

      {/* PWA Install */}
      <PWAInstallPrompt />
    </div>
  );
}
