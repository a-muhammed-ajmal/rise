import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─── TAILWIND CLASS HELPER ────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── DATE / TIME HELPERS ─────────────────────────────────────────────────────

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-AE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatMonthYear(date: Date = new Date()): string {
  return date.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' });
}

export function getMonthYear(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getTimeGreeting(name?: string): string {
  const hour = new Date().getHours();
  const firstName = name?.split(' ')[0] ?? '';
  if (hour >= 5 && hour < 12) return `Good morning${firstName ? ', ' + firstName : ''}`;
  if (hour >= 12 && hour < 17) return `Good afternoon${firstName ? ', ' + firstName : ''}`;
  return `Good evening${firstName ? ', ' + firstName : ''}`;
}

export function formatDayDateTime(): string {
  return new Date().toLocaleString('en-AE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayISO();
}

export function isOverdue(dateStr: string): boolean {
  return dateStr < todayISO();
}

export function getDaysUntil(dateStr: string): number {
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── CURRENCY ────────────────────────────────────────────────────────────────
export function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── AVATAR COLOR ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#FF6B35', '#1ABC9C', '#1E4AFF', '#FF4F6D',
  '#FFD700', '#800080', '#FF9933', '#00BCD4',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─── PERCENT ─────────────────────────────────────────────────────────────────
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ─── RANDOM ──────────────────────────────────────────────────────────────────
export function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── TRUNCATE ────────────────────────────────────────────────────────────────
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

// ─── SLEEP ───────────────────────────────────────────────────────────────────
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── DEBOUNCE ────────────────────────────────────────────────────────────────
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
