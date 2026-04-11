'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MoreSheet } from './MoreSheet';
import { DesktopSidebar } from './DesktopSidebar';
import { QuickCreateSheet, GlobalFabButton } from './GlobalFab';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { PWAInstallPrompt } from '@/components/providers/PWAInstallPrompt';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const router = useRouter();

  const handleQuickAction = (label: string) => {
    setFabOpen(false);
    if (label === 'Action') {
      router.push('/tasks?create=true');
    }
  };

  return (
    <div className="min-h-dvh bg-[#0A0A0A]">
      <DesktopSidebar />

      <MobileHeader />

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />

      <QuickCreateSheet
        open={fabOpen}
        onClose={() => setFabOpen(false)}
        onAction={handleQuickAction}
      />

      <GlobalFabButton onClick={() => setFabOpen((o) => !o)} open={fabOpen} />

      <main
        className="
          pt-10 pb-14 min-h-dvh
          sm:pt-0 sm:pb-0 sm:pl-[200px]
        "
      >
        {children}
      </main>

      <MobileBottomNav onMoreClick={() => setMoreOpen(true)} />

      <ToastContainer />

      <PWAInstallPrompt />
    </div>
  );
}
