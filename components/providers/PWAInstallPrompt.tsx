'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { LS_KEYS } from '@/lib/constants';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(LS_KEYS.PWA_INSTALL_DISMISSED);
    if (dismissed) return;

    // Increment visit count
    const visits = parseInt(localStorage.getItem(LS_KEYS.VISIT_COUNT) ?? '0') + 1;
    localStorage.setItem(LS_KEYS.VISIT_COUNT, String(visits));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (visits >= 3) setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem(LS_KEYS.PWA_INSTALL_DISMISSED, 'true');
    }
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(LS_KEYS.PWA_INSTALL_DISMISSED, 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-[72px] left-4 right-4 z-50 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-card p-4 shadow-card flex items-center gap-3">
        <div className="w-10 h-10 bg-[#FF6B35]/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-[#FF6B35]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F0F0F0]">Add RISE to Home Screen</p>
          <p className="text-xs text-[#8A8A8A]">Install for the best experience</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="text-xs font-semibold text-[#FF6B35] px-3 py-1.5 rounded-button bg-[#FF6B35]/10"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-[#8A8A8A] p-1"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
