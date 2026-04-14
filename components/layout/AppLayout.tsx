'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileSidebar } from './MobileSidebar';
import { DesktopSidebar } from './DesktopSidebar';
import { QuickCreateSheet, GlobalFabButton } from './GlobalFab';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { PWAInstallPrompt } from '@/components/providers/PWAInstallPrompt';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const router = useRouter();

  const handleQuickAction = (label: string) => {
    setFabOpen(false);
    if (label === 'Action') {
      router.push('/tasks?create=true');
    } else if (label === 'Target') {
      router.push('/tasks?createTarget=true');
    }
  };

  return (
    <div className="min-h-dvh bg-[#F2F2F7]">
      <DesktopSidebar />

      <MobileHeader onMenuClick={() => setMobileNavOpen(true)} />

      <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <QuickCreateSheet
        open={fabOpen}
        onClose={() => setFabOpen(false)}
        onAction={handleQuickAction}
      />

      {/* Desktop-only FAB — on mobile the + lives in MobileBottomNav */}
      <GlobalFabButton onClick={() => setFabOpen((o) => !o)} open={fabOpen} />

      <main
        className="
          pt-14 pb-16 min-h-dvh
          sm:pt-0 sm:pb-0 sm:pl-[200px]
        "
      >
        {children}
      </main>

      <MobileBottomNav
        onPlusClick={() => setFabOpen((o) => !o)}
        plusOpen={fabOpen}
      />

      <ToastContainer />

      <PWAInstallPrompt />
    </div>
  );
}
