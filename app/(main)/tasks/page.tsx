'use client';

import {
  useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Plus, Sun, Repeat, Bell, Paperclip, Calendar, X, Check,
  ChevronLeft, ChevronRight, Copy, Trash2, Briefcase, Star,
  CheckSquare, Keyboard, Clock, Menu, Crosshair, ChevronDown, Edit2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, deleteDocById, createDoc } from '@/lib/firestore';
import { COLLECTIONS, REALM_CONFIG, REALMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Task, Project, Priority, Recurrence, TaskStep, TaskReminder } from '@/lib/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { SkeletonListItem } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

// ─── PREMIUM UI COMPONENTS ──────────────────────────────────────────────────

function ArrowCheck({ 
  completed, 
  color, 
  onClick, 
  size = 18 
}: { 
  completed: boolean; 
  color: string; 
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 flex items-center justify-center transition-all active:scale-90"
      style={{ width: size, height: size }}
    >
      <div 
        className={cn(
          "w-full h-full rounded-full border-2 flex items-center justify-center transition-colors",
          completed ? "border-transparent" : "border-[#AEAEB2]"
        )}
        style={{ backgroundColor: completed ? color : 'transparent' }}
      >
        {completed && (
          <Check size={size * 0.6} strokeWidth={3} className="text-white" />
        )}
      </div>
    </button>
  );
}


// ─── PRIORITY CONFIG (per spec §17.2) ────────────────────────────────────────

const TASK_PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444',
  P2: '#F59E0B',
  P3: '#3B82F6',
  P4: '#6B7280',
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  P1: 'Do Now',
  P2: 'Important',
  P3: 'Get Done',
  P4: 'Default',
};

const REMINDER_OPTIONS = [
  'None',
  'On due date',
  '5 minutes before',
  '10 minutes before',
  '30 minutes before',
  '1 hour before',
  '1 day before',
  '2 days before',
  '1 week before',
  'Custom',
] as const;

const RECURRING_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekdays', label: 'Weekdays' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Yearly', label: 'Yearly' },
  { value: 'Custom', label: 'Custom' },
];

const CUSTOM_DAYS_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

function parseDueDate(s: string): Date | null {
  if (!s) return null;
  if (s.includes('/')) {
    const [d, m, y] = s.split('/').map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
  }
  if (s.includes('-') && s.length === 10) return new Date(s + 'T00:00:00');
  return null;
}

function toDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function todayMidnight(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function getNextDueDateFromStr(current: string, recurring: Recurrence, customDays?: number[]): string {
  const parsed = parseDueDate(current);
  if (!parsed) return current;
  const d = new Date(parsed);
  if (recurring === 'Daily') {
    d.setDate(d.getDate() + 1);
  } else if (recurring === 'Weekdays') {
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  } else if (recurring === 'Weekly') {
    d.setDate(d.getDate() + 7);
  } else if (recurring === 'Monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (recurring === 'Yearly') {
    d.setFullYear(d.getFullYear() + 1);
  } else if (recurring === 'Custom' && customDays && customDays.length > 0) {
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 7; i++) {
      const jsDay = d.getDay(); // 0=Sun
      const specDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
      if (customDays.includes(specDay)) break;
      d.setDate(d.getDate() + 1);
    }
  }
  return toDDMMYYYY(d);
}

function getDueDateDisplay(dueDate: string | undefined, dueTime: string | undefined): { label: string; color: string } | null {
  if (!dueDate) return null;
  const parsed = parseDueDate(dueDate);
  if (!parsed) return null;
  const today = todayMidnight();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const ts = parsed.getTime();

  let label: string;
  let color: string;
  if (ts === today.getTime()) {
    label = 'Today'; color = '#1C1C1E';
  } else if (ts === yesterday.getTime()) {
    label = 'Yesterday'; color = '#EF4444';
  } else if (ts === tomorrow.getTime()) {
    label = 'Tomorrow'; color = '#1ABC9C';
  } else if (ts < today.getTime()) {
    label = dueDate.includes('/') ? dueDate : dueDate.split('-').reverse().join('/');
    color = '#EF4444';
  } else {
    label = dueDate.includes('/') ? dueDate : dueDate.split('-').reverse().join('/');
    color = '#1ABC9C';
  }
  if (dueTime) label += ` ${dueTime}`;
  return { label, color };
}

function isTaskOverdue(task: Task): boolean {
  if (task.isCompleted || !task.dueDate) return false;
  const parsed = parseDueDate(task.dueDate);
  if (!parsed) return false;
  return parsed.getTime() < todayMidnight().getTime();
}

// ─── CALENDAR GRID ────────────────────────────────────────────────────────────

function CalendarGrid({
  year, month, selectedDDMMYYYY,
  onSelectDate, onPrevMonth, onNextMonth,
}: {
  year: number; month: number; selectedDDMMYYYY: string;
  onSelectDate: (day: number) => void;
  onPrevMonth: () => void; onNextMonth: () => void;
}) {
  const today = new Date();
  const todayD = today.getDate(), todayM = today.getMonth(), todayY = today.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  let selDay = 0, selMonth = -1, selYear = 0;
  if (selectedDDMMYYYY) {
    const parts = selectedDDMMYYYY.split('/');
    if (parts.length === 3) {
      [selDay, selMonth, selYear] = parts.map(Number);
      selMonth -= 1;
    }
  }

  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrevMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] text-[#6C6C70]">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-[#1C1C1E]">{MONTH_NAMES[month]} {year}</span>
        <button type="button" onClick={onNextMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] text-[#6C6C70]">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="h-8 flex items-center justify-center">
            <span className="text-[11px] font-medium text-[#AEAEB2]">{d}</span>
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-10" />;
          const isToday = day === todayD && month === todayM && year === todayY;
          const isSelected = day === selDay && month === selMonth && year === selYear;
          return (
            <div key={i} className="h-10 flex items-center justify-center">
              <button
                type="button"
                onClick={() => onSelectDate(day)}
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm transition-colors',
                  isSelected
                    ? 'bg-[#3B82F6] text-white font-semibold'
                    : isToday
                      ? 'text-[#3B82F6] font-semibold hover:bg-[#F5F5F5]'
                      : 'text-[#1C1C1E] hover:bg-[#F5F5F5]'
                )}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CLOCK FACE ───────────────────────────────────────────────────────────────

function ClockFaceHour({ hour, onSelect }: { hour: number; onSelect: (h: number) => void }) {
  const cx = 100, cy = 100, numR = 72, handR = 60;
  const getPos = (n: number, r: number) => {
    const norm = n === 12 ? 0 : n;
    const rad = (norm * 30 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const handEnd = getPos(hour, handR);
  return (
    <svg viewBox="0 0 200 200" className="w-52 h-52 mx-auto select-none">
      <circle cx={cx} cy={cy} r={92} fill="#F2F2F7" />
      <line x1={cx} y1={cy} x2={handEnd.x} y2={handEnd.y} stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#3B82F6" />
      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => {
        const p = getPos(n, numR);
        const sel = n === hour;
        return (
          <g key={n} style={{ cursor: 'pointer' }} onClick={() => onSelect(n)}>
            <circle cx={p.x} cy={p.y} r={18} fill={sel ? '#3B82F6' : 'transparent'} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
              fontSize={14} fill={sel ? 'white' : '#1C1C1E'} fontFamily="sans-serif">
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ClockFaceMinute({ minute, onSelect }: { minute: number; onSelect: (m: number) => void }) {
  const cx = 100, cy = 100, numR = 72, handR = 60;
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const getPos = (idx: number, r: number) => {
    const rad = (idx * 30 - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const selIdx = Math.round(minute / 5) % 12;
  const handEnd = getPos(selIdx, handR);
  return (
    <svg viewBox="0 0 200 200" className="w-52 h-52 mx-auto select-none">
      <circle cx={cx} cy={cy} r={92} fill="#F2F2F7" />
      <line x1={cx} y1={cy} x2={handEnd.x} y2={handEnd.y} stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#3B82F6" />
      {mins.map((m, idx) => {
        const p = getPos(idx, numR);
        const sel = m === minute;
        return (
          <g key={m} style={{ cursor: 'pointer' }} onClick={() => onSelect(m)}>
            <circle cx={p.x} cy={p.y} r={18} fill={sel ? '#3B82F6' : 'transparent'} />
            <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
              fontSize={13} fill={sel ? 'white' : '#1C1C1E'} fontFamily="sans-serif">
              {m === 0 ? '00' : String(m)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── DATE-TIME PICKER SHEET ───────────────────────────────────────────────────

function DateTimePickerSheet({
  open, dueDate, dueTime, onSave, onClose,
}: {
  open: boolean;
  dueDate: string; // DD/MM/YYYY or ''
  dueTime: string; // hh:mm AM/PM or ''
  onSave: (date: string, time: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const [tab, setTab] = useState<'date' | 'time'>('date');
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const [tempDate, setTempDate] = useState('');
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);
  const [tempAmPm, setTempAmPm] = useState<'AM' | 'PM'>('AM');
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour');
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [keyboardInput, setKeyboardInput] = useState('');

  useEffect(() => {
    if (open) {
      setTab('date');
      setKeyboardMode(false);
      setClockMode('hour');
      // Parse existing dueDate
      if (dueDate) {
        setTempDate(dueDate);
        const parsed = parseDueDate(dueDate);
        if (parsed) {
          setPickerYear(parsed.getFullYear());
          setPickerMonth(parsed.getMonth());
        }
      } else {
        setTempDate('');
        setPickerYear(today.getFullYear());
        setPickerMonth(today.getMonth());
      }
      // Parse existing dueTime (hh:mm AM/PM)
      if (dueTime) {
        const match = dueTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
          setTempHour(parseInt(match[1]));
          setTempMinute(parseInt(match[2]));
          setTempAmPm(match[3].toUpperCase() as 'AM' | 'PM');
          setKeyboardInput(dueTime);
        }
      } else {
        setTempHour(9); setTempMinute(0); setTempAmPm('AM');
        setKeyboardInput('');
      }
    }
  }, [open, dueDate, dueTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDay = (day: number) => {
    const d = String(day).padStart(2, '0');
    const m = String(pickerMonth + 1).padStart(2, '0');
    setTempDate(`${d}/${m}/${pickerYear}`);
  };

  const handleHourSelect = (h: number) => {
    setTempHour(h);
    setClockMode('minute');
  };

  const handleMinuteSelect = (m: number) => {
    setTempMinute(m);
  };

  const buildTimeStr = () => {
    if (keyboardMode && keyboardInput.trim()) {
      const match = keyboardInput.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        const h = parseInt(match[1]);
        const min = parseInt(match[2]);
        const ap = match[3] ? match[3].toUpperCase() : (h >= 12 ? 'PM' : 'AM');
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ap}`;
      }
    }
    return `${String(tempHour).padStart(2, '0')}:${String(tempMinute).padStart(2, '0')} ${tempAmPm}`;
  };

  const displayTime = `${tempHour}:${String(tempMinute).padStart(2, '0')}`;

  const handleSave = () => {
    const timeStr = tab === 'time' || dueTime ? buildTimeStr() : '';
    onSave(tempDate, timeStr);
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>CANCEL</Button>
          <Button fullWidth onClick={handleSave}>SAVE</Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex border-b border-[#E5E5EA] mb-4">
        {(['date', 'time'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 pb-2 text-xs font-semibold tracking-wider uppercase transition-colors',
              tab === t ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]' : 'text-[#AEAEB2]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'date' ? (
        <div className="flex flex-col gap-2">
          {/* Selected date display */}
          <div className="bg-[#3B82F6] rounded-card px-4 py-3 mb-2">
            {tempDate ? (
              <p className="text-white text-2xl font-semibold">
                {(() => {
                  const parsed = parseDueDate(tempDate);
                  if (!parsed) return tempDate;
                  return parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                })()}
              </p>
            ) : (
              <p className="text-white/70 text-2xl font-semibold">Select a date</p>
            )}
          </div>
          <CalendarGrid
            year={pickerYear}
            month={pickerMonth}
            selectedDDMMYYYY={tempDate}
            onSelectDate={handleSelectDay}
            onPrevMonth={() => {
              if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); }
              else setPickerMonth(m => m - 1);
            }}
            onNextMonth={() => {
              if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); }
              else setPickerMonth(m => m + 1);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {/* Time display */}
          <div className="bg-[#3B82F6] rounded-card w-full px-4 py-3 flex items-center justify-center gap-4">
            <span className="text-white text-4xl font-semibold tracking-tight">{displayTime}</span>
            <div className="flex flex-col gap-1">
              {(['AM', 'PM'] as const).map((ap) => (
                <button
                  key={ap}
                  type="button"
                  onClick={() => setTempAmPm(ap)}
                  className={cn(
                    'text-base font-semibold px-1 leading-none',
                    ap === tempAmPm ? 'text-white' : 'text-white/40'
                  )}
                >
                  {ap}
                </button>
              ))}
            </div>
          </div>

          {keyboardMode ? (
            <div className="w-full flex flex-col gap-2">
              <p className="text-xs text-[#6C6C70] text-center">Enter time (e.g. 9:30 AM)</p>
              <input
                type="text"
                value={keyboardInput}
                onChange={(e) => setKeyboardInput(e.target.value)}
                placeholder="9:30 AM"
                className="w-full bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6] text-center"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setKeyboardMode(false)}
                className="self-center flex items-center gap-1 text-xs text-[#6C6C70]"
              >
                <Clock size={14} /> Switch to clock
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs font-medium text-[#6C6C70] mb-1">
                  {clockMode === 'hour' ? 'Select hour' : 'Select minute'}
                </p>
                {clockMode === 'hour' ? (
                  <ClockFaceHour hour={tempHour} onSelect={handleHourSelect} />
                ) : (
                  <ClockFaceMinute minute={tempMinute} onSelect={handleMinuteSelect} />
                )}
              </div>
              <button
                type="button"
                onClick={() => setKeyboardMode(true)}
                className="flex items-center gap-1.5 text-xs text-[#6C6C70] self-start"
              >
                <Keyboard size={15} /> Enter time manually
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── RECURRING PICKER SHEET ───────────────────────────────────────────────────

function RecurringPickerSheet({
  open, recurring, customDays, onSave, onClose,
}: {
  open: boolean;
  recurring: Recurrence;
  customDays: number[];
  onSave: (r: Recurrence, days: number[]) => void;
  onClose: () => void;
}) {
  const [tempRecurring, setTempRecurring] = useState<Recurrence>(recurring);
  const [tempDays, setTempDays] = useState<number[]>(customDays);

  useEffect(() => {
    if (open) { setTempRecurring(recurring); setTempDays(customDays); }
  }, [open, recurring, customDays]);

  const toggleDay = (d: number) => {
    setTempDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Repeat">
      <div className="flex flex-col gap-1">
        {RECURRING_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => { setTempRecurring(value); if (value !== 'Custom') { onSave(value, []); onClose(); } }}
            className="flex items-center gap-3 px-2 py-3 rounded-card hover:bg-[#F5F5F5] transition-colors"
          >
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
              tempRecurring === value ? 'border-[#3B82F6] bg-[#3B82F6]' : 'border-[#AEAEB2]'
            )}>
              {tempRecurring === value && <Check size={11} className="text-white" />}
            </div>
            <span className="text-sm text-[#1C1C1E]">{label}</span>
          </button>
        ))}

        {tempRecurring === 'Custom' && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex gap-2 justify-center">
              {CUSTOM_DAYS_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={cn(
                    'w-10 h-10 rounded-full text-sm font-semibold transition-colors',
                    tempDays.includes(idx)
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-[#F5F5F5] text-[#6C6C70]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              fullWidth
              onClick={() => { onSave('Custom', tempDays); onClose(); }}
              disabled={tempDays.length === 0}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── REMINDER PICKER SHEET ────────────────────────────────────────────────────

function ReminderPickerSheet({
  open, reminder, onSave, onClose,
}: {
  open: boolean;
  reminder: TaskReminder;
  onSave: (r: TaskReminder) => void;
  onClose: () => void;
}) {
  const [tempOption, setTempOption] = useState(reminder.option || 'None');
  const [tempCustomDate, setTempCustomDate] = useState('');
  const [tempCustomTime, setTempCustomTime] = useState('');
  const [customDtPickerOpen, setCustomDtPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setTempOption(reminder.option || 'None');
      const parts = (reminder.customDateTime || '').trim().split(' ');
      if (parts.length >= 3) {
        setTempCustomDate(parts[0]);
        setTempCustomTime(`${parts[1]} ${parts[2]}`);
      } else {
        setTempCustomDate('');
        setTempCustomTime('');
      }
      setCustomDtPickerOpen(false);
    }
  }, [open, reminder]);

  const handleSaveCustom = () => {
    if (!tempCustomDate || !tempCustomTime) return;
    onSave({ enabled: true, option: 'Custom', customDateTime: `${tempCustomDate} ${tempCustomTime}` });
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Reminder"
        footer={tempOption === 'Custom' ? (
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
            <Button fullWidth disabled={!tempCustomDate || !tempCustomTime} onClick={handleSaveCustom}>Save</Button>
          </div>
        ) : undefined}
      >
        <div className="flex flex-col gap-1">
          {REMINDER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setTempOption(opt);
                if (opt !== 'Custom') {
                  onSave({ enabled: opt !== 'None', option: opt, customDateTime: undefined });
                  onClose();
                }
              }}
              className="flex items-center gap-3 px-2 py-3 rounded-card hover:bg-[#F5F5F5] transition-colors"
            >
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                tempOption === opt ? 'border-[#3B82F6] bg-[#3B82F6]' : 'border-[#AEAEB2]'
              )}>
                {tempOption === opt && <Check size={11} className="text-white" />}
              </div>
              <span className="text-sm text-[#1C1C1E]">{opt}</span>
            </button>
          ))}

          {tempOption === 'Custom' && (
            <div className="mt-3 p-3 bg-[#F5F5F5] rounded-card border border-[#E5E5EA]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#1C1C1E]">Custom date and time</p>
                  <p className="text-xs text-[#6C6C70]">
                    {tempCustomDate && tempCustomTime ? `${tempCustomDate} ${tempCustomTime}` : 'Set a custom reminder date and time'}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setCustomDtPickerOpen(true)}>
                  Set
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <DateTimePickerSheet
        open={customDtPickerOpen}
        dueDate={tempCustomDate}
        dueTime={tempCustomTime}
        onSave={(d, t) => {
          setTempCustomDate(d);
          setTempCustomTime(t);
        }}
        onClose={() => setCustomDtPickerOpen(false)}
      />
    </>
  );
}

// ─── STEPS EDITOR ─────────────────────────────────────────────────────────────

function StepsEditor({
  steps,
  onChange,
}: {
  steps: TaskStep[];
  onChange: (steps: TaskStep[]) => void;
}) {
  const [newStepText, setNewStepText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addStep = () => {
    const text = newStepText.trim();
    if (!text) return;
    onChange([...steps, { id: Date.now().toString(), text, done: false }]);
    setNewStepText('');
    inputRef.current?.focus();
  };

  const toggleDone = (id: string) => {
    onChange(steps.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const deleteStep = (id: string) => {
    onChange(steps.filter(s => s.id !== id));
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[#1C1C1E]">Add steps</label>
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => toggleDone(step.id)}
            className={cn(
              'flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
              step.done ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#AEAEB2]'
            )}
          >
            {step.done && <Check size={12} className="text-white" />}
          </button>
          <span className={cn('flex-1 text-sm', step.done && 'line-through text-[#AEAEB2]')}>{step.text}</span>
          <button
            type="button"
            onClick={() => deleteStep(step.id)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-[#AEAEB2] hover:text-[#EF4444]"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={newStepText}
          onChange={(e) => setNewStepText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
          placeholder="Add a step"
          className="flex-1 bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none focus:border-[#FF6B35] focus:bg-white"
        />
        <button
          type="button"
          onClick={addStep}
          className="w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white hover:bg-[#E55A25] flex-shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

// ─── TASK FORM STATE ──────────────────────────────────────────────────────────

interface TaskForm {
  title: string;
  description: string;
  steps: TaskStep[];
  realm: string;
  targetId: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  recurring: Recurrence;
  customDays: number[];
  reminder: TaskReminder;
  isMyDay: boolean;
}

const DEFAULT_FORM: TaskForm = {
  title: '',
  description: '',
  steps: [],
  realm: 'Personal',
  targetId: '',
  priority: 'P4',
  dueDate: '',
  dueTime: '',
  recurring: 'None',
  customDays: [],
  reminder: { enabled: false, option: 'None' },
  isMyDay: false,
};

// ─── TASK MODAL (CREATE & EDIT) ───────────────────────────────────────────────

function TaskModal({
  open, onClose, task, projects, userId,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  projects: Project[];
  userId: string;
}) {
  const [form, setForm] = useState<TaskForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [dtPickerOpen, setDtPickerOpen] = useState(false);
  const [recurringPickerOpen, setRecurringPickerOpen] = useState(false);
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({
          title: task.title,
          description: task.description ?? '',
          steps: task.steps ?? [],
          realm: task.realm || 'Personal',
          targetId: task.targetId ?? task.projectId ?? '',
          priority: task.priority,
          dueDate: task.dueDate ?? '',
          dueTime: task.dueTime ?? '',
          recurring: task.recurring ?? 'None',
          customDays: task.customDays ?? [],
          reminder: task.reminder ?? { enabled: false, option: 'None' },
          isMyDay: task.isMyDay,
        });
        setSelectedFileName('');
      } else {
        setForm({ ...DEFAULT_FORM });
        setSelectedFileName('');
      }
      setIsDirty(false);
    }
  }, [open, task]);

  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => {
    setIsDirty(true);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const realmProjects = projects.filter((p) => p.realm === form.realm);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Action title is required'); return; }
    setSaving(true);
    try {
      const data = {
        userId,
        title: sanitize(form.title.trim(), 200),
        description: form.description.trim() || undefined,
        steps: form.steps.length > 0 ? form.steps : undefined,
        realm: form.realm,
        targetId: form.targetId || undefined,
        projectId: form.targetId || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        recurring: form.recurring,
        customDays: form.customDays.length > 0 ? form.customDays : undefined,
        reminder: form.reminder,
        isMyDay: form.isMyDay,
        isStarred: task?.isStarred ?? false,
        isCompleted: task?.isCompleted ?? false,
        completedAt: task?.completedAt,
        order: task?.order ?? Date.now(),
        createdAt: task?.createdAt ?? new Date().toISOString(),
      };
      if (task) {
        await updateDocById(COLLECTIONS.TASKS, task.id, data);
        toast.success('Action updated');
      } else {
        await createDoc(COLLECTIONS.TASKS, data);
        toast.success('Action added');
      }
      onClose();
    } catch {
      toast.error('Failed to save action');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!form.title.trim()) { toast.error('Action title is required'); return; }
    setSaving(true);
    try {
      await createDoc(COLLECTIONS.TASKS, {
        userId,
        title: sanitize(`${form.title.trim()} (Copy)`, 200),
        description: form.description.trim() || undefined,
        steps: form.steps.length > 0 ? form.steps : undefined,
        realm: form.realm,
        targetId: form.targetId || undefined,
        projectId: form.targetId || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        dueTime: form.dueTime || undefined,
        recurring: form.recurring,
        customDays: form.customDays.length > 0 ? form.customDays : undefined,
        reminder: form.reminder,
        isMyDay: form.isMyDay,
        isStarred: task?.isStarred ?? false,
        isCompleted: task?.isCompleted ?? false,
        completedAt: task?.completedAt,
        order: Date.now(),
        createdAt: new Date().toISOString(),
      });
      toast.success('Action duplicated');
    } catch {
      toast.error('Failed to duplicate action');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (task) {
      await deleteDocById(COLLECTIONS.TASKS, task.id);
      toast.success('Action deleted');
      onClose();
      return;
    }
    setForm({ ...DEFAULT_FORM });
    setSelectedFileName('');
    setIsDirty(false);
    toast.success('Draft cleared');
  };

  const dueDateInfo = getDueDateDisplay(form.dueDate, form.dueTime);
  const recurringLabel = form.recurring === 'None' ? 'Does not repeat'
    : form.recurring === 'Custom' ? `Custom (${form.customDays.map(i => CUSTOM_DAYS_LABELS[i]).join(', ')})`
      : form.recurring;
  const reminderLabel = !form.reminder.enabled
    ? 'No reminder'
    : form.reminder.option === 'Custom' && form.reminder.customDateTime
      ? `Custom (${form.reminder.customDateTime})`
      : form.reminder.option;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? 'Edit Action' : 'Add Action'}
        footer={
          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" fullWidth onClick={handleDuplicate}>Duplicate</Button>
            <Button variant="danger" fullWidth onClick={handleDelete}>Delete</Button>
            {task ? (
              isDirty ? (
                <Button fullWidth loading={saving} onClick={handleSave}>Update</Button>
              ) : (
                <Button fullWidth variant="secondary" onClick={onClose}>Cancel</Button>
              )
            ) : (
              <Button fullWidth loading={saving} onClick={handleSave}>Add</Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Title with check circle */}
          <div className="flex items-center gap-2 border-b border-[#E5E5EA] pb-2">
            <div
              className="flex-shrink-0 w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center"
              style={{ borderColor: TASK_PRIORITY_COLORS[form.priority] ?? '#6B7280' }}
            />
            <input
              type="text"
              placeholder="Action title"
              maxLength={200}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus={!task}
              className="flex-1 text-base text-[#1C1C1E] placeholder-[#AEAEB2] outline-none bg-transparent focus:border-[#FF6B35]"
            />
          </div>

          {/* Add Detail section with file attachment icon */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#1C1C1E]">Add details</label>
              <button
                type="button"
                onClick={() => { fileInputRef.current?.click(); }}
                className="w-9 h-9 flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E] rounded-full hover:bg-[#F5F5F5]"
              >
                <Paperclip size={14} />
              </button>
            </div>
            <textarea
              placeholder="Add notes or description"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-3 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none focus:border-[#FF6B35] focus:bg-white resize-none"
            />
            {selectedFileName && (
              <p className="text-xs text-[#6C6C70]">📎 {selectedFileName}</p>
            )}
          </div>

          {/* Steps */}
          <StepsEditor steps={form.steps} onChange={(s) => set('steps', s)} />

          {/* Area of Life / Target / Focus Day - compact row */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] px-3 py-2">
              <span className="text-base">{REALM_CONFIG[form.realm]?.emoji}</span>
              <select
                value={form.realm}
                onChange={(e) => { set('realm', e.target.value); set('targetId', ''); }}
                className="flex-1 bg-transparent text-sm text-[#1C1C1E] outline-none appearance-none"
              >
                {REALMS.map((r) => (
                  <option key={r} value={r}>{REALM_CONFIG[r].emoji} {r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] px-3 py-2">
              <span className="text-[#6C6C70]">⊙</span>
              <select
                value={form.targetId}
                onChange={(e) => set('targetId', e.target.value)}
                className="flex-1 bg-transparent text-sm text-[#1C1C1E] outline-none appearance-none"
              >
                <option value="">No target</option>
                {realmProjects.length === 0 ? (
                  <option value="" disabled>No targets in this Realm yet</option>
                ) : (
                  realmProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)
                )}
              </select>
            </div>
            <button
              type="button"
              onClick={() => set('isMyDay', !form.isMyDay)}
              className={cn(
                'flex items-center gap-2 rounded-input border px-3 py-2 text-sm font-medium transition-colors',
                form.isMyDay ? 'border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]' : 'border-[#E5E5EA] bg-[#F5F5F5] text-[#1C1C1E]'
              )}
            >
              <Sun size={16} className={form.isMyDay ? 'text-[#FF6B35]' : 'text-[#6C6C70]'} />
              <span className="hidden sm:inline">Focus Day</span>
            </button>
          </div>

          {/* Priority / Due Date / Repeat / Reminders - equal-sized row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2.5">
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: TASK_PRIORITY_COLORS[form.priority] ?? '#6B7280' }} />
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as Priority)}
                className="bg-transparent text-[11px] font-medium text-[#1C1C1E] outline-none text-center w-full"
              >
                {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => (
                  <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setDtPickerOpen(true)}
              className="relative flex flex-col items-center justify-center gap-1 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2 text-center overflow-hidden"
            >
              <Calendar size={13} className="text-[#6C6C70]" />
              <span className={cn('text-[10px] font-medium leading-tight w-full truncate', form.dueDate ? 'text-[#3B82F6]' : 'text-[#1C1C1E]')}>
                {form.dueDate ? form.dueDate : 'Due Date'}
              </span>
              {form.dueDate && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); set('dueDate', ''); set('dueTime', ''); }}
                  className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[#AEAEB2] hover:text-[#EF4444]"
                >
                  <X size={9} />
                </button>
              )}
            </button>
            <button
              type="button"
              onClick={() => setRecurringPickerOpen(true)}
              className="flex flex-col items-center justify-center gap-1 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2 text-center"
            >
              <Repeat size={13} className="text-[#6C6C70]" />
              <span className={cn('text-[10px] font-medium leading-tight', form.recurring !== 'None' ? 'text-[#3B82F6]' : 'text-[#1C1C1E]')}>
                {form.recurring === 'None' ? 'Repeat' : form.recurring}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReminderPickerOpen(true)}
              className="flex flex-col items-center justify-center gap-1 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2 text-center"
            >
              <Bell size={13} className={form.reminder.enabled ? 'text-[#3B82F6]' : 'text-[#6C6C70]'} />
              <span className={cn('text-[10px] font-medium leading-tight', form.reminder.enabled ? 'text-[#3B82F6]' : 'text-[#1C1C1E]')}>
                {form.reminder.enabled ? (form.reminder.option === 'Custom' ? 'Custom' : 'On') : 'Remind'}
              </span>
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setSelectedFileName(file.name);
                toast.info('File upload coming soon');
              }
            }}
          />
        </div>
      </Modal>

      <DateTimePickerSheet
        open={dtPickerOpen}
        dueDate={form.dueDate}
        dueTime={form.dueTime}
        onSave={(d, t) => { set('dueDate', d); set('dueTime', t); }}
        onClose={() => setDtPickerOpen(false)}
      />

      <RecurringPickerSheet
        open={recurringPickerOpen}
        recurring={form.recurring}
        customDays={form.customDays}
        onSave={(r, d) => { set('recurring', r); set('customDays', d); }}
        onClose={() => setRecurringPickerOpen(false)}
      />

      <ReminderPickerSheet
        open={reminderPickerOpen}
        reminder={form.reminder}
        onSave={(r) => set('reminder', r)}
        onClose={() => setReminderPickerOpen(false)}
      />
    </>
  );
}

// ─── ACTION DETAIL POPUP ──────────────────────────────────────────────────────

function ActionDetailPopup({
  open, onClose, task, projects, userId, onComplete,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  projects: Project[];
  userId: string;
  onComplete: (t: Task) => void;
}) {
  const [titleVal, setTitleVal] = useState('');
  const [descVal, setDescVal] = useState('');
  const [targetName, setTargetName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [subSheet, setSubSheet] = useState<'realm' | 'target' | 'priority' | 'datetime' | 'recurring' | 'reminder' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addStepInput, setAddStepInput] = useState('');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepText, setEditingStepText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const realmProjects = projects.filter((p) => p.realm === task?.realm);
  const targetProject = projects.find((p) => task && p.id === (task.targetId ?? task.projectId));

  useEffect(() => {
    if (open && task) {
      setTitleVal(task.title);
      setDescVal(task.description ?? '');
      setTargetName(targetProject?.title ?? '');
      setIsDirty(false);
      setSubSheet(null);
      setEditingStepId(null);
      setEditingStepText('');
      setAddStepInput('');
    }
  }, [open, task, targetProject]);

  if (!task) return null;

  const save = async (fields: Partial<Task>) => {
    try {
      await updateDocById(COLLECTIONS.TASKS, task.id, fields);
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleToggleStep = async (stepId: string) => {
    setIsDirty(true);
    const steps = (task.steps ?? []).map(s => s.id === stepId ? { ...s, done: !s.done } : s);
    await save({ steps });
  };

  const handleDeleteStep = async (stepId: string) => {
    setIsDirty(true);
    const steps = (task.steps ?? []).filter(s => s.id !== stepId);
    await save({ steps });
  };

  const handleAddStep = async (text: string) => {
    setIsDirty(true);
    const steps = [...(task.steps ?? []), { id: Date.now().toString(), text, done: false }];
    await save({ steps });
    setAddStepInput('');
  };

  const handleEditStep = async () => {
    if (!editingStepId || !editingStepText.trim()) return;
    setIsDirty(true);
    const steps = (task.steps ?? []).map((s) => (
      s.id === editingStepId ? { ...s, text: editingStepText.trim() } : s
    ));
    await save({ steps });
    setEditingStepId(null);
    setEditingStepText('');
  };

  const handleTargetInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const title = targetName.trim();
    if (!title) return;
    const existing = realmProjects.find((p) => p.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      setIsDirty(true);
      await save({ targetId: existing.id, projectId: existing.id });
      toast.success('Target selected.');
      return;
    }
    const cfg = REALM_CONFIG[task.realm] ?? { emoji: '🎯', color: '#FF6B35' };
    const newProjectId = await createDoc(COLLECTIONS.PROJECTS, {
      userId,
      title: sanitize(title, 100),
      realm: task.realm,
      color: cfg.color,
      icon: cfg.emoji,
      isFavorite: false,
      order: Date.now(),
      createdAt: new Date().toISOString(),
    });
    setIsDirty(true);
    await save({ targetId: newProjectId, projectId: newProjectId });
    toast.success('Target created and assigned.');
  };

  const handleDuplicate = async () => {
    const { id: _id, completedAt: _ca, ...rest } = task;
    void _id; void _ca;
    await createDoc(COLLECTIONS.TASKS, {
      ...rest,
      title: `${task.title} (Copy)`,
      isCompleted: false,
      completedAt: undefined,
      order: Date.now(),
      createdAt: new Date().toISOString(),
    });
    toast.success('Action duplicated');
    onClose();
  };

  const handleDelete = async () => {
    await deleteDocById(COLLECTIONS.TASKS, task.id);
    toast.success('Action deleted');
    setDeleteConfirmOpen(false);
    onClose();
  };

  const priorityColor = TASK_PRIORITY_COLORS[task.priority] ?? '#6B7280';
  const dueDateInfo = getDueDateDisplay(task.dueDate, task.dueTime);
  const recurringLabel = !task.recurring || task.recurring === 'None' ? 'Does not repeat'
    : task.recurring === 'Custom' ? `Custom (${(task.customDays ?? []).map(i => CUSTOM_DAYS_LABELS[i]).join(', ')})`
      : task.recurring;
  const reminderLabel = !task.reminder?.enabled
    ? 'No reminder'
    : task.reminder?.option === 'Custom' && task.reminder?.customDateTime
      ? `Custom (${task.reminder.customDateTime})`
      : (task.reminder.option || 'No reminder');



  const handleSaveChanges = async () => {
    if (!titleVal.trim()) { toast.error('Action title is required'); return; }
    const updateFields: Partial<Task> = {};
    if (titleVal.trim() !== task.title) updateFields.title = sanitize(titleVal.trim(), 200);
    if (descVal.trim() !== (task.description ?? '')) updateFields.description = descVal.trim() || undefined;
    if (Object.keys(updateFields).length > 0) {
      await save(updateFields);
      setIsDirty(false);
      toast.success('Action updated');
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
      >
        {/* Top line */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA] mb-4">
          <span className="text-xs uppercase tracking-[0.2em] text-[#6C6C70]">Edit Action</span>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 w-8 h-8 flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E] rounded-full hover:bg-[#F5F5F5]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#E5E5EA] mb-4">
          <button
            type="button"
            onClick={() => onComplete(task)}
            className="flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: priorityColor, backgroundColor: task.isCompleted ? priorityColor + '20' : 'transparent' }}
          >
            {task.isCompleted && <Check size={11} style={{ color: priorityColor }} />}
          </button>
          <input
            type="text"
            value={titleVal}
            onChange={(e) => { setTitleVal(e.target.value); setIsDirty(true); }}
            onBlur={async () => {
              if (titleVal.trim() && titleVal.trim() !== task.title) {
                await save({ title: sanitize(titleVal.trim(), 200) });
                setIsDirty(false);
              } else if (!titleVal.trim()) {
                setTitleVal(task.title);
              }
            }}
            placeholder="Action title"
            autoFocus={false}
            className="flex-1 text-lg font-semibold text-[#1C1C1E] bg-transparent outline-none"
          />
        </div>

        <div className="flex flex-col gap-3">
          {/* Add detail section */}
          <div className="flex flex-col gap-2 bg-[#F5F5F5] border border-[#E5E5EA] rounded-input p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#6C6C70]">Add detail</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-7 h-7 flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E] rounded-full hover:bg-white/50"
              >
                <Paperclip size={14} />
              </button>
            </div>
            <textarea
              value={descVal}
              onChange={(e) => { setDescVal(e.target.value); setIsDirty(true); }}
              onBlur={async () => {
                if (descVal.trim() !== (task.description ?? '')) {
                  await save({ description: descVal.trim() || undefined });
                  setIsDirty(false);
                }
              }}
              rows={3}
              placeholder="Write notes or description"
              autoFocus={false}
              className="w-full resize-none bg-transparent text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none"
            />
          </div>

          {/* Add Step section */}
          <div className="py-2 border-t border-[#F2F2F7]">
            {(task.steps ?? []).map((step) => (
              <div key={step.id} className="flex items-center gap-2 py-1.5">
                <button type="button" onClick={() => handleToggleStep(step.id)}
                  className={cn('flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center',
                    step.done ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#AEAEB2]')}>
                  {step.done && <Check size={10} className="text-white" />}
                </button>
                {editingStepId === step.id ? (
                  <input
                    value={editingStepText}
                    onChange={(e) => setEditingStepText(e.target.value)}
                    onBlur={handleEditStep}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEditStep(); }}
                    className="flex-1 bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-2 py-1 text-sm text-[#1C1C1E] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingStepId(step.id); setEditingStepText(step.text); }}
                    className={cn('flex-1 text-sm text-left', step.done && 'line-through text-[#AEAEB2]')}
                  >
                    {step.text}
                  </button>
                )}
                <button type="button" onClick={() => handleDeleteStep(step.id)}
                  className="w-6 h-6 flex items-center justify-center text-[#AEAEB2] hover:text-[#EF4444]">
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={addStepInput}
                onChange={(e) => setAddStepInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addStepInput.trim()) {
                    e.preventDefault();
                    handleAddStep(addStepInput.trim());
                  }
                }}
                placeholder="Add a step"
                className="flex-1 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none bg-transparent py-1"
              />
              <button
                type="button"
                onClick={() => { if (addStepInput.trim()) handleAddStep(addStepInput.trim()); }}
                className="w-8 h-8 rounded-full bg-[#FF6B35] flex items-center justify-center text-white hover:bg-[#E55A25]"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Realm / Target / Focus Day row */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] px-3 py-2">
              <span className="text-base">{REALM_CONFIG[task.realm]?.emoji}</span>
              <select
                value={task.realm}
                onChange={async (e) => {
                  const realm = e.target.value;
                  setIsDirty(true);
                  await save({ realm, targetId: undefined, projectId: undefined });
                  setTargetName('');
                }}
                className="flex-1 bg-transparent text-sm text-[#1C1C1E] outline-none appearance-none"
              >
                {REALMS.map((r) => (
                  <option key={r} value={r}>{REALM_CONFIG[r].emoji} {r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] px-3 py-2">
              <span className="text-[#6C6C70]">⊙</span>
              <input
                list="task-target-options"
                value={targetName}
                onChange={(e) => { setTargetName(e.target.value); setIsDirty(true); }}
                onKeyDown={handleTargetInputKeyDown}
                placeholder="Target"
                className="flex-1 bg-transparent text-sm text-[#1C1C1E] outline-none"
              />
              <datalist id="task-target-options">
                {realmProjects.map((p) => (
                  <option key={p.id} value={p.title} />
                ))}
              </datalist>
            </div>
            <button
              type="button"
              onClick={async () => { setIsDirty(true); await save({ isMyDay: !task.isMyDay }); }}
              className="flex items-center gap-2 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] px-3 py-2"
            >
              <Sun size={16} className={task.isMyDay ? 'text-[#FF6B35]' : 'text-[#6C6C70]'} />
              <span className="hidden sm:inline text-sm text-[#1C1C1E]">Focus Day</span>
            </button>
          </div>

          {/* Priority / Due Date / Repeat / Reminders row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <button type="button" onClick={() => setSubSheet('priority')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2.5 text-center">
              <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor }} />
              <span className="text-[11px] font-medium text-[#1C1C1E]">Priority</span>
            </button>
            <button type="button" onClick={() => setSubSheet('datetime')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2.5 text-center">
              <Calendar size={14} className="text-[#6C6C70]" />
              <span className="text-[11px] font-medium text-[#1C1C1E]">Due Date</span>
            </button>
            <button type="button" onClick={() => setSubSheet('recurring')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2.5 text-center">
              <Repeat size={14} className="text-[#6C6C70]" />
              <span className="text-[11px] font-medium text-[#1C1C1E]">Repeat</span>
            </button>
            <button type="button" onClick={() => setSubSheet('reminder')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2.5 text-center">
              <Bell size={14} className="text-[#6C6C70]" />
              <span className="text-[11px] font-medium text-[#1C1C1E]">Reminders</span>
            </button>
          </div>

          {/* Bottom buttons */}
          <div className="grid gap-3 pt-3 border-t border-[#E5E5EA] sm:grid-cols-3">
            <Button variant="secondary" fullWidth onClick={handleDuplicate}>Duplicate</Button>
            <Button variant="danger" fullWidth onClick={() => setDeleteConfirmOpen(true)}>Delete</Button>
            <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          </div>

          {/* File input for details */}
          <input ref={fileInputRef} type="file" className="hidden" />
        </div>
      </Modal>

      {/* Sub-sheet: Realm selector */}
      {subSheet === 'realm' && (
        <Modal open={true} onClose={() => setSubSheet(null)} title="Select Realm">
          <div className="flex flex-col gap-1">
            {REALMS.map((r) => (
              <button key={r} type="button"
                onClick={async () => {
                  setSubSheet(null);
                  await save({ realm: r, targetId: undefined, projectId: undefined });
                }}
                className={cn('flex items-center gap-3 py-3 px-2 rounded-card hover:bg-[#F5F5F5] transition-colors',
                  task.realm === r && 'bg-[#F5F5F5]')}>
                <span className="text-xl">{REALM_CONFIG[r].emoji}</span>
                <span className="flex-1 text-sm text-[#1C1C1E]">{r}</span>
                {task.realm === r && <Check size={16} className="text-[#3B82F6]" />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Sub-sheet: Target selector */}
      {subSheet === 'target' && (
        <Modal open={true} onClose={() => setSubSheet(null)} title="Select Target">
          <div className="flex flex-col gap-1">
            <button type="button"
              onClick={async () => { setSubSheet(null); await save({ targetId: undefined, projectId: undefined }); }}
              className={cn('flex items-center gap-3 py-3 px-2 rounded-card hover:bg-[#F5F5F5] transition-colors',
                !task.targetId && !task.projectId && 'bg-[#F5F5F5]')}>
              <span className="flex-1 text-sm text-[#1C1C1E]">No target</span>
              {!task.targetId && !task.projectId && <Check size={16} className="text-[#3B82F6]" />}
            </button>
            {realmProjects.length === 0 ? (
              <p className="text-xs text-[#AEAEB2] px-2 py-2">No targets in this Realm yet</p>
            ) : (
              realmProjects.map((p) => (
                <button key={p.id} type="button"
                  onClick={async () => {
                    setSubSheet(null);
                    await save({ targetId: p.id, projectId: p.id });
                  }}
                  className={cn('flex items-center gap-3 py-3 px-2 rounded-card hover:bg-[#F5F5F5] transition-colors',
                    (task.targetId === p.id || task.projectId === p.id) && 'bg-[#F5F5F5]')}>
                  <span className="flex-1 text-sm text-[#1C1C1E]">{p.title}</span>
                  {(task.targetId === p.id || task.projectId === p.id) && <Check size={16} className="text-[#3B82F6]" />}
                </button>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Sub-sheet: Priority selector */}
      {subSheet === 'priority' && (
        <Modal open={true} onClose={() => setSubSheet(null)} title="Select Priority">
          <div className="flex flex-col gap-1">
            {(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => (
              <button key={p} type="button"
                onClick={async () => { setSubSheet(null); await save({ priority: p }); }}
                className={cn('flex items-center gap-3 py-3 px-2 rounded-card hover:bg-[#F5F5F5] transition-colors',
                  task.priority === p && 'bg-[#F5F5F5]')}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TASK_PRIORITY_COLORS[p] }} />
                <span className="flex-1 text-sm text-[#1C1C1E]">{TASK_PRIORITY_LABELS[p]}</span>
                {task.priority === p && <Check size={16} className="text-[#3B82F6]" />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Sub-sheet: Date & Time */}
      <DateTimePickerSheet
        open={subSheet === 'datetime'}
        dueDate={task.dueDate ?? ''}
        dueTime={task.dueTime ?? ''}
        onSave={async (d, t) => { await save({ dueDate: d || undefined, dueTime: t || undefined }); }}
        onClose={() => setSubSheet(null)}
      />

      {/* Sub-sheet: Recurring */}
      <RecurringPickerSheet
        open={subSheet === 'recurring'}
        recurring={task.recurring ?? 'None'}
        customDays={task.customDays ?? []}
        onSave={async (r, days) => { await save({ recurring: r, customDays: days }); }}
        onClose={() => setSubSheet(null)}
      />

      {/* Sub-sheet: Reminder */}
      <ReminderPickerSheet
        open={subSheet === 'reminder'}
        reminder={task.reminder ?? { enabled: false, option: 'None' }}
        onSave={async (r) => { await save({ reminder: r }); }}
        onClose={() => setSubSheet(null)}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this action?"
        message={`"${task.title}" will be permanently deleted.`}
        confirmLabel="Delete"
      />
    </>
  );
}

// ─── TARGET POPUP (NEW) ───────────────────────────────────────────────────────

interface TargetForm {
  title: string;
  realm: string;
  dueDate: string;
  isCompleted: boolean;
}

function TargetPopup({
  open, onClose, project, tasks, userId,
}: {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  tasks: Task[];
  userId: string;
}) {
  const [form, setForm] = useState<TargetForm>({ 
    title: '', 
    realm: 'Personal', 
    dueDate: '',
    isCompleted: false 
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [realmDropdownOpen, setRealmDropdownOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (project) {
        setForm({
          title: project.title,
          realm: project.realm,
          dueDate: project.dueDate ?? '',
          isCompleted: project.isCompleted ?? false,
        });
      } else {
        setForm({ 
          title: '', 
          realm: 'Personal', 
          dueDate: '',
          isCompleted: false 
        });
      }
      setIsDirty(false);
    }
  }, [open, project]);

  const set = <K extends keyof TargetForm>(k: K, v: TargetForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Target title is required'); return; }
    setSaving(true);
    const cfg = REALM_CONFIG[form.realm] ?? { emoji: '🎯', color: '#FF6B35' };
    try {
      const data = {
        userId,
        title: sanitize(form.title, 100),
        realm: form.realm,
        color: cfg.color,
        icon: cfg.emoji,
        isFavorite: project?.isFavorite ?? false,
        isCompleted: form.isCompleted,
        completedAt: form.isCompleted ? (project?.completedAt ?? new Date().toISOString()) : undefined,
        order: project?.order ?? Date.now(),
        dueDate: form.dueDate || undefined,
      };
      if (project) {
        await updateDocById(COLLECTIONS.PROJECTS, project.id, data);
        toast.success('Target updated');
      } else {
        await createDoc(COLLECTIONS.PROJECTS, data);
        toast.success('Target created');
      }
      onClose();
    } catch {
      toast.error('Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    try {
      await deleteDocById(COLLECTIONS.PROJECTS, project.id);
      toast.success('Target deleted');
      onClose();
    } catch {
      toast.error('Failed to delete target');
    }
  };

  if (!open) return null;

  return (
    <>
      <Modal open={open} onClose={onClose} forceModal className="max-w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-[0.2em] text-[#6C6C70]">{project ? 'Edit Target' : 'Add Target'}</span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-[#6C6C70]" />
          </button>
        </div>

        {/* Target title input */}
        <div className="mb-4">
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Target title"
            autoFocus={false}
            className="w-full bg-transparent outline-none py-2 text-base font-semibold text-[#1C1C1E] placeholder-[#AEAEB2] border-b border-[#E5E5EA] focus:border-[#FF6B35] transition-colors"
          />
        </div>

        {/* Area of Life Dropdown */}
        <div className="mb-4">
          <label className="text-xs font-medium text-[#6C6C70] mb-1 block">Area of Life</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setRealmDropdownOpen(!realmDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-input bg-[#F5F5F5] border border-[#E5E5EA] active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{REALM_CONFIG[form.realm]?.emoji}</span>
                <span className="text-sm text-[#1C1C1E]">{form.realm}</span>
              </div>
              <ChevronDown size={14} className={cn("text-[#AEAEB2] transition-transform", realmDropdownOpen && "rotate-180")} />
            </button>

            {realmDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#E5E5EA] rounded-card shadow-sheet p-[2px]">
                {REALMS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { set('realm', r); setRealmDropdownOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[#F5F5F5] transition-colors",
                      form.realm === r && 'bg-[#F5F5F5]'
                    )}
                  >
                    <span className="text-base">{REALM_CONFIG[r].emoji}</span>
                    <span className="text-sm text-[#1C1C1E]">{r}</span>
                    {form.realm === r && <Check size={14} className="ml-auto text-[#3B82F6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-[#E5E5EA] my-4" />

        {/* Footer buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setIsDirty(true); }}
            disabled={!project}
            className="flex-1 h-10 rounded bg-[#F5F5F5] border border-[#E5E5EA] text-[12px] font-[500] text-[#1C1C1E] disabled:opacity-40"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!project}
            className="flex-1 h-10 rounded bg-[#F5F5F5] border border-[#E5E5EA] text-[12px] font-[500] text-[#FF4F6D] disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={!project ? handleSave : (isDirty ? handleSave : onClose)}
            className="flex-1 h-10 rounded bg-[#FF6B35] text-white text-[12px] font-[500]"
          >
            {!project ? 'Add' : (isDirty ? 'Update' : 'Cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
}






// ─── TARGET CARD (NEW) ────────────────────────────────────────────────────────
interface TargetCardProps {
  project: Project;
  tasks: Task[];
  onEdit: (p: Project) => void;
  onToggleComplete: (p: Project) => void;
}

function TargetCard({ project, tasks, onEdit, onToggleComplete }: TargetCardProps) {
  const projectTasks = tasks.filter(t => (t.targetId ?? t.projectId) === project.id);
  const completedCount = projectTasks.filter(t => t.isCompleted).length;
  const totalCount = projectTasks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  // Time remaining % calculation
  const getTimeRemainingPercent = () => {
    if (!project.dueDate || !project.createdAt) return 0;
    const start = new Date(project.createdAt).getTime();
    const end = new Date(project.dueDate).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    const total = end - start;
    if (total <= 0) return 0;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };
  const timePercent = getTimeRemainingPercent();
  const realmColor = REALM_CONFIG[project.realm]?.color || '#FF6B35';

  return (
    <div 
      onClick={() => onEdit(project)}
      className="bg-white rounded-card border border-[#E5E5EA] p-4 flex flex-col gap-3 active:scale-[0.98] transition-all cursor-pointer shadow-sm hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <ArrowCheck 
          completed={project.isCompleted || false} 
          color={realmColor} 
          onClick={(e) => { e.stopPropagation(); onToggleComplete(project); }} 
        />
        <h3 className={cn(
          "text-[15px] font-semibold text-[#1C1C1E] flex-1 truncate",
          project.isCompleted && "line-through text-[#AEAEB2]"
        )}>
          {project.title}
        </h3>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#6C6C70]">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          <span>{project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB') : 'No date'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: realmColor }} />
          <span>{project.realm}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
            <span>Time Used</span>
            <span>{timePercent}%</span>
          </div>
          <ProgressBar value={timePercent} color={timePercent > 90 ? "#FF4F6D" : "#FF9933"} height={4} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
            <span>Actions Done</span>
            <span>{completedCount}/{totalCount} ({progressPercent}%)</span>
          </div>
          <ProgressBar value={progressPercent} color="#34C759" height={4} />
        </div>
      </div>
    </div>
  );
}


// ─── ACTIONS PAGE ─────────────────────────────────────────────────────────────

type TabId = 'today' | 'inbox' | 'upcoming' | 'completed' | 'targets';

export default function ActionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: tasks, loading: tasksLoading } = useCollection<Task>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TASKS,
    enabled: !!user,
  });
  const { data: projects, loading: projectsLoading } = useCollection<Project>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.PROJECTS,
    enabled: !!user,
  });

  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [targetPopupOpen, setTargetPopupOpen] = useState(false);
  const [detailPopupOpen, setDetailPopupOpen] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedRealm, setSelectedRealm] = useState<string>('All');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [inBulkMode, setInBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [targetsSubTab, setTargetsSubTab] = useState<string>('All');
  const { permission, pendingCount, requestPermission } = useNotifications(user?.uid ?? '');

  const handleBellClick = async () => {
    if (permission === 'denied') {
      toast.error('Notifications are blocked. Enable them in your browser settings.');
      return;
    }
    if (permission !== 'granted') {
      const result = await requestPermission();
      if (result === 'granted') {
        toast.success('Notifications enabled! You\'ll be reminded about your actions and rhythms.');
      } else {
        toast.error('Notification permission denied.');
      }
      return;
    }
    if (pendingCount > 0) {
      toast.info(`You have ${pendingCount} pending action${pendingCount !== 1 ? 's' : ''} today.`);
    } else {
      toast.success('You\'re all caught up!');
    }
  };

  // Open create modal if ?create=true in URL
  useEffect(() => {
    if (searchParams?.get('create') === 'true') {
      setSelectedTask(null);
      setTaskModalOpen(true);
      router.replace('/tasks');
      return;
    }

    if (searchParams?.get('createTarget') === 'true') {
      setSelectedProject(null);
      setTargetPopupOpen(true);
      router.replace('/tasks');
      return;
    }

    const editId = searchParams?.get('edit');
    if (editId && tasks.length > 0) {
      const taskToEdit = tasks.find((t) => t.id === editId);
      if (taskToEdit) {
        setSelectedTask(taskToEdit);
        setTaskModalOpen(true);
        router.replace('/tasks');
      }
    }
  }, [searchParams, router, tasks]);

  useEffect(() => {
    if (inBulkMode && selectedTasks.size === 0) setInBulkMode(false);
  }, [selectedTasks, inBulkMode]);

  // ── Tab content ──────────────────────────────────────────────────────────
  const today = todayMidnight();
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);

  const todayTasks = useMemo(() => {
    const active = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = parseDueDate(t.dueDate);
      return due ? due.getTime() <= today.getTime() : false;
    });
    const uncompleted = active.filter(t => !t.isCompleted).sort((a, b) => {
      const aOver = isTaskOverdue(a) ? 0 : 1;
      const bOver = isTaskOverdue(b) ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      return parseInt(a.priority[1]) - parseInt(b.priority[1]);
    });
    const completed = active.filter(t => t.isCompleted).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return [...uncompleted, ...completed];
  }, [tasks, today]);

  const inboxTasks = useMemo(() => {
    const active = tasks.filter((t) => !t.dueDate);
    const uncompleted = active.filter(t => !t.isCompleted).sort((a, b) => parseInt(a.priority[1]) - parseInt(b.priority[1]));
    const completed = active.filter(t => t.isCompleted).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return [...uncompleted, ...completed];
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    const active = tasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = parseDueDate(t.dueDate);
      return due ? due.getTime() > today.getTime() : false;
    });
    const uncompleted = active.filter(t => !t.isCompleted).sort((a, b) => {
      const da = parseDueDate(a.dueDate!)?.getTime() ?? 0;
      const db = parseDueDate(b.dueDate!)?.getTime() ?? 0;
      return da - db;
    });
    const completed = active.filter(t => t.isCompleted).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return [...uncompleted, ...completed];
  }, [tasks, today]);

  const completedTasks = useMemo(() => tasks.filter(
    (t) => t.isCompleted && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo
  ).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [tasks, sevenDaysAgo]);

  const filteredTargets = useMemo(() => {
    let p = projects;
    if (selectedRealm !== 'All') {
      p = p.filter(proj => proj.realm === selectedRealm);
    }
    
    const uncompleted = p.filter(proj => !proj.isCompleted).sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    
    const completed = p.filter(proj => proj.isCompleted).sort((a, b) => 
      (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
    );
    
    return [...uncompleted, ...completed];
  }, [projects, selectedRealm]);

  const currentTabTasks: Task[] = {
    today: todayTasks, inbox: inboxTasks, upcoming: upcomingTasks,
    completed: completedTasks, targets: [],
  }[activeTab];

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (task: Task) => {
    const now = new Date().toISOString();
    const willComplete = !task.isCompleted;
    await updateDocById(COLLECTIONS.TASKS, task.id, {
      isCompleted: willComplete,
      completedAt: willComplete ? now : undefined,
    });
    if (willComplete) {
      toast.success('Action completed!');
      if (task.recurring && task.recurring !== 'None' && task.dueDate) {
        const nextDue = getNextDueDateFromStr(task.dueDate, task.recurring, task.customDays);
        const { id: _id, completedAt: _ca, ...rest } = task;
        void _id; void _ca;
        await createDoc(COLLECTIONS.TASKS, {
          ...rest,
          dueDate: nextDue,
          isCompleted: false,
          completedAt: undefined,
          order: Date.now(),
          createdAt: now,
        });
      }
    }
  }, []);

  const handleBulkComplete = async () => {
    const now = new Date().toISOString();
    await Promise.all(
      Array.from(selectedTasks).map((id) =>
        updateDocById(COLLECTIONS.TASKS, id, { isCompleted: true, completedAt: now })
      )
    );
    toast.success(`${selectedTasks.size} action(s) completed.`);
    setSelectedTasks(new Set()); setInBulkMode(false);
  };

  const handleBulkDelete = async () => {
    await Promise.all(Array.from(selectedTasks).map((id) => deleteDocById(COLLECTIONS.TASKS, id)));
    toast.success(`${selectedTasks.size} action(s) deleted.`);
    setSelectedTasks(new Set()); setInBulkMode(false); setBulkDeleteConfirm(false);
  };

  const toggleSelect = useCallback((task: Task) => {
    setInBulkMode(true);
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
      return next;
    });
  }, []);

  const handleDeleteProject = useCallback(async () => {
    if (!selectedProject) return;
    const linked = tasks.filter((t) => (t.targetId ?? t.projectId) === selectedProject.id);
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      linked.map((t) => updateDocById(COLLECTIONS.TASKS, t.id, { targetId: null, projectId: null } as any))
    );
    await deleteDocById(COLLECTIONS.PROJECTS, selectedProject.id);
    toast.success('Target deleted.');
    setSelectedProject(null);
  }, [selectedProject, tasks]);

  const handleToggleFavorite = useCallback(async (project: Project) => {
    await updateDocById(COLLECTIONS.PROJECTS, project.id, { isFavorite: !project.isFavorite });
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Complete' },
    { id: 'targets', label: 'Targets' },
  ];

  const emptyMessages: Record<TabId, { title: string; subtitle: string }> = {
    today: { title: 'All clear today', subtitle: 'No actions due today. Enjoy your day!' },
    inbox: { title: 'Inbox is empty', subtitle: 'Actions without a Target appear here.' },
    upcoming: { title: 'Nothing upcoming', subtitle: 'Schedule actions with a future due date.' },
    completed: { title: 'Nothing completed recently', subtitle: 'Complete actions to see them here.' },
    targets: { title: 'No Targets yet', subtitle: 'Create your first Target to organise your Actions.' },
  };

  const loading = tasksLoading || projectsLoading;

  const targetTabs = ['All', ...REALMS];
  const filteredProjects = useMemo(() => {
    if (targetsSubTab === 'All') return projects;
    return projects.filter((p) => p.realm === targetsSubTab);
  }, [projects, targetsSubTab]);

  const overdueCount = todayTasks.filter((t) => isTaskOverdue(t)).length;

  return (
    <div className="flex flex-col min-h-dvh bg-[#F2F2F7]">
      {/* Redesigned Header: ☰ logo RISE – Actions [+ Add] 🔔 */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5EA] px-3 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-[#6C6C70] rounded-full hover:bg-[#F2F2F7]"
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center gap-1.5">
            <Image
              src="/icons/icon-maskable-912.png"
              alt="RISE"
              width={22}
              height={22}
              priority
            />
            <span className="text-[15px] font-bold text-[#FF9933] tracking-widest">RISE</span>
            <span className="text-[#AEAEB2] mx-0.5">—</span>
            <span className="text-[15px] font-semibold text-[#1C1C1E]">Actions</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'targets') {
                setSelectedProject(null);
                setTargetPopupOpen(true);
              } else {
                setSelectedTask(null);
                setTaskModalOpen(true);
              }
            }}
            className="h-10 px-2 flex items-center gap-1 text-[13px] font-medium text-[#FF6B35] active:scale-95 transition-all"
          >
            <Plus size={14} />
            {activeTab === 'targets' ? 'Target' : 'Action'}
          </button>
          
          <button
            type="button"
            onClick={handleBellClick}
            className="w-10 h-10 flex items-center justify-center text-[#6C6C70] rounded-full hover:bg-[#F2F2F7]"
          >
            <Bell size={20} />
          </button>
        </div>
      </header>

      {/* Main Tabs */}
      <div className="bg-white border-b border-[#E5E5EA] overflow-x-auto no-scrollbar">
        <div className="flex px-4 h-11">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setInBulkMode(false); setSelectedTasks(new Set()); }}
              className={cn(
                'flex-shrink-0 px-4 h-full text-[13px] font-medium transition-all relative',
                activeTab === tab.id ? 'text-[#FF6B35]' : 'text-[#6C6C70]'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#FF6B35] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Bulk toolbar */}
      {inBulkMode && selectedTasks.size > 0 && (
        <div className="sticky top-14 z-30 flex items-center gap-3 px-4 py-2 bg-[#F5F5F5] border-b border-[#E5E5EA] animate-fade-in">
          <span className="text-[12px] font-medium text-[#1C1C1E] flex-1">{selectedTasks.size} selected</span>
          <button onClick={() => { setInBulkMode(false); setSelectedTasks(new Set()); }} className="text-[12px] text-[#6C6C70] font-medium">Cancel</button>
          <button onClick={handleBulkComplete} className="text-[12px] text-[#FF6B35] font-semibold">Complete</button>
          <button onClick={() => setBulkDeleteConfirm(true)} className="text-[12px] text-[#FF4F6D] font-semibold">Delete</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 pb-24">
        {activeTab === 'targets' ? (
          <div className="flex flex-col">
            {/* Realm Tabs */}
            <div className="flex gap-2 overflow-x-auto p-4 no-scrollbar">
              {['All', ...REALMS].map((realmName) => (
                <button
                  key={realmName}
                  type="button"
                  onClick={() => setSelectedRealm(realmName)}
                  className={cn(
                    'flex-shrink-0 h-9 px-4 rounded-full text-[12px] font-medium transition-colors',
                    selectedRealm === realmName
                      ? 'bg-[#FF6B35] text-white'
                      : 'bg-white text-[#6C6C70] border border-[#E5E5EA]'
                  )}
                >
                  {realmName}
                </button>
              ))}
            </div>

            <div className="px-4 flex flex-col gap-2">
              {loading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-white rounded-card border border-[#E5E5EA] animate-pulse" />)}
                </div>
              ) : filteredTargets.length === 0 ? (
                <EmptyState
                  icon={Crosshair}
                  title="No Targets match your filter"
                  subtitle="Try selecting a different realm or create a new target."
                />
              ) : (
                filteredTargets.map((p) => (
                  <TargetCard
                    key={p.id}
                    project={p}
                    tasks={tasks}
                    onEdit={(proj) => { setSelectedProject(proj); setTargetPopupOpen(true); }}
                    onToggleComplete={async (proj) => {
                      const completed = !proj.isCompleted;
                      await updateDocById(COLLECTIONS.PROJECTS, proj.id, { 
                        isCompleted: completed,
                        completedAt: completed ? new Date().toISOString() : undefined
                      });
                      toast.success(completed ? 'Target achieved!' : 'Target reopened');
                    }}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          /* Task List Tabs content */
          <div className="px-4 py-4 flex flex-col gap-2">
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-white rounded-md border border-[#F2F2F7] animate-pulse" />)}
              </div>
            ) : currentTabTasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title={emptyMessages[activeTab].title}
                subtitle={emptyMessages[activeTab].subtitle}
                actionLabel={`+ New Action`}
                onAction={() => { setSelectedTask(null); setTaskModalOpen(true); }}
              />
            ) : (
              currentTabTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  projects={projects}
                  onComplete={handleComplete}
                  onEdit={(task) => { setSelectedTask(task); setDetailPopupOpen(true); }}
                  selected={selectedTasks.has(t.id)}
                  onSelect={toggleSelect}
                  inBulkMode={inBulkMode}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        projects={projects}
        userId={user?.uid ?? ''}
      />

      <ActionDetailPopup
        open={detailPopupOpen && !!selectedTask}
        onClose={() => {
          setDetailPopupOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        projects={projects}
        userId={user?.uid ?? ''}
        onComplete={handleComplete}
      />

      <TargetPopup
        open={targetPopupOpen}
        onClose={() => {
          setTargetPopupOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        tasks={tasks}
        userId={user?.uid ?? ''}
      />

      <ConfirmModal
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Actions"
        message={`Delete ${selectedTasks.size} selected action(s)? This cannot be undone.`}
        confirmLabel="Delete All"
      />
    </div>
  );
}
