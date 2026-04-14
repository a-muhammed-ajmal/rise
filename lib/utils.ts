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
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

export function formatMonthYear(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${year}`;
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
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
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

export function formatCurrency(amount: number): string {
  return formatAED(amount);
}

// ─── TIME ─────────────────────────────────────────────────────────────────────
export function formatTime(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
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
