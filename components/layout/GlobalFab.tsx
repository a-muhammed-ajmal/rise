'use client';

import { useState } from 'react';
import {
  Plus,
  CheckSquare,
  UserPlus,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FabOption {
  label: string;
  icon: typeof Plus;
  color: string;
  onClick: () => void;
}

interface GlobalFabProps {
  options: FabOption[];
}

const DEFAULT_OPTIONS: FabOption[] = [
  { label: 'Action', icon: CheckSquare, color: '#FF6B35', onClick: () => {} },
  { label: 'Lead', icon: UserPlus, color: '#1E4AFF', onClick: () => {} },
  { label: 'Deal', icon: Handshake, color: '#1ABC9C', onClick: () => {} },
  { label: 'Connection', icon: UserPlus, color: '#FF4F6D', onClick: () => {} },
  { label: 'Income', icon: TrendingUp, color: '#1ABC9C', onClick: () => {} },
  { label: 'Expense', icon: TrendingDown, color: '#FF4F6D', onClick: () => {} },
  { label: 'Rhythm', icon: Activity, color: '#1ABC9C', onClick: () => {} },
  { label: 'Document', icon: FileText, color: '#8E95A9', onClick: () => {} },
];

export function QuickCreateSheet({
  open,
  onClose,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (label: string) => void;
}) {
  if (!open) return null;

  const items = [
    { label: 'Action', icon: CheckSquare, color: '#FF6B35' },
    { label: 'Lead', icon: UserPlus, color: '#1E4AFF' },
    { label: 'Deal', icon: Briefcase, color: '#1ABC9C' },
    { label: 'Connection', icon: UserPlus, color: '#FF4F6D' },
    { label: 'Income', icon: TrendingUp, color: '#1ABC9C' },
    { label: 'Expense', icon: TrendingDown, color: '#FF4F6D' },
    { label: 'Rhythm', icon: Activity, color: '#1ABC9C' },
    { label: 'Document', icon: FileText, color: '#8E95A9' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 bg-[#141414] rounded-t-sheet sm:rounded-card w-full sm:max-w-md mx-0 sm:mx-4 sm:mb-24 p-4 pb-safe">
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#2A2A2A]" />
        </div>
        <p className="text-xs text-[#8A8A8A] text-center mb-4 font-medium uppercase tracking-wider">
          Quick Create
        </p>
        <div className="grid grid-cols-4 gap-3">
          {items.map(({ label, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => onAction(label)}
              className="flex flex-col items-center gap-2 p-3 rounded-card bg-[#1C1C1C] active:scale-95 transition-transform"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: color + '22' }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <span className="text-xs text-[#F0F0F0]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DesktopFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hidden sm:flex fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#FF6B35] rounded-full items-center justify-center shadow-fab active:scale-95 transition-transform"
      aria-label="Quick create"
    >
      <Plus size={24} className="text-white" />
    </button>
  );
}
