'use client';

import Link from 'next/link';
import {
  Eye, Wallet, Briefcase, Users, Compass, BookOpen, FileText, MessageSquare,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

const MORE_LINKS = [
  { href: '/goals', icon: Eye, label: 'Visions', accent: '#FF6B35' },
  { href: '/finance', icon: Wallet, label: 'Finance', accent: '#1ABC9C' },
  { href: '/professional', icon: Briefcase, label: 'Professional', accent: '#1E4AFF' },
  { href: '/relationships', icon: Users, label: 'Relationships', accent: '#FF4F6D' },
  { href: '/reviews', icon: Compass, label: 'Reviews', accent: '#FFD700' },
  { href: '/journal', icon: BookOpen, label: 'Journal', accent: '#800080' },
  { href: '/documents', icon: FileText, label: 'Documents', accent: '#8E95A9' },
  { href: '/chat', icon: MessageSquare, label: 'AI Chat', accent: '#FF9933' },
];

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const pathname = usePathname();

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-[#141414] rounded-t-sheet w-full p-4 pb-safe">
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-[#2A2A2A]" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {MORE_LINKS.map(({ href, icon: Icon, label, accent }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 p-3 rounded-card bg-[#1C1C1C] active:scale-95 transition-transform"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accent + '22' }}
              >
                <Icon size={18} style={{ color: accent }} />
              </div>
              <span className="text-xs text-[#F0F0F0] text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
