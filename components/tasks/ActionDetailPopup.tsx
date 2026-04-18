'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Check, Plus, X, Sun, Calendar, Repeat, Bell, Paperclip,
  ChevronLeft, ChevronRight, Clock, Keyboard,
} from 'lucide-react';
import { updateDocById, deleteDocById, createDoc } from '@/lib/firestore';
import { COLLECTIONS, REALM_CONFIG, REALMS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Task, Project, Priority, Recurrence, TaskReminder } from '@/lib/types';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444',
  P2: '#F97316',
  P3: '#3B82F6',
  P4: '#6B7280',
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
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

export const CUSTOM_DAYS_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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

export function getDueDateDisplay(
  dueDate: string | undefined,
  dueTime: string | undefined,
): { label: string; color: string } | null {
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
  if (dueTime) {
    const normalized = dueTime.trim();
    if (normalized.match(/(am|pm)\s*$/i)) {
      label += ` ${normalized}`;
    } else {
      const [h, m] = normalized.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const suffix = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        label += ` ${hour}:${String(m).padStart(2, '0')} ${suffix}`;
      } else {
        label += ` ${normalized}`;
      }
    }
  }
  return { label, color };
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

export function DateTimePickerSheet({
  open, dueDate, dueTime, onSave, onClose,
}: {
  open: boolean;
  dueDate: string;
  dueTime: string;
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

  const handleHourSelect = (h: number) => { setTempHour(h); setClockMode('minute'); };
  const handleMinuteSelect = (m: number) => { setTempMinute(m); };

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

export function RecurringPickerSheet({
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
            onClick={() => {
              setTempRecurring(value);
              if (value !== 'Custom') { onSave(value, []); onClose(); }
            }}
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
                    tempDays.includes(idx) ? 'bg-[#3B82F6] text-white' : 'bg-[#F5F5F5] text-[#6C6C70]'
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

export function ReminderPickerSheet({
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
                  onSave({ enabled: opt !== 'None', option: opt });
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
                    {tempCustomDate && tempCustomTime
                      ? `${tempCustomDate} ${tempCustomTime}`
                      : 'Set a custom reminder date and time'}
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
        onSave={(d, t) => { setTempCustomDate(d); setTempCustomTime(t); }}
        onClose={() => setCustomDtPickerOpen(false)}
      />
    </>
  );
}

// ─── ACTION DETAIL POPUP ──────────────────────────────────────────────────────

export function ActionDetailPopup({
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

  return (
    <>
      <Modal open={open} onClose={onClose} title="Edit Action">
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
          {/* Add detail */}
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
              rows={2}
              placeholder="Write notes or description"
              autoFocus={false}
              className="w-full resize-none bg-transparent text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none"
            />
          </div>

          {/* Steps */}
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

          {/* Realm / Target / Focus Day */}
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
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] px-3 py-2">
              <span className="text-[#6C6C70]">⊙</span>
              <input
                list="adp-target-options"
                value={targetName}
                onChange={(e) => { setTargetName(e.target.value); setIsDirty(true); }}
                onKeyDown={handleTargetInputKeyDown}
                placeholder="Target"
                className="flex-1 bg-transparent text-sm text-[#1C1C1E] outline-none"
              />
              <datalist id="adp-target-options">
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

          {/* Priority / Due Date / Repeat / Reminders */}
          {(() => {
            const dueDateInfo = getDueDateDisplay(task.dueDate, task.dueTime);
            const recurringActive = task.recurring && task.recurring !== 'None';
            const reminderActive = task.reminder?.enabled;
            const recurringLabel = recurringActive
              ? (task.recurring === 'Custom'
                ? `Custom`
                : task.recurring!)
              : 'Repeat';
            const reminderLabel = reminderActive
              ? (task.reminder!.option === 'Custom' ? 'Custom' : task.reminder!.option)
              : 'Remind';
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                {/* Priority chip */}
                <button type="button" onClick={() => setSubSheet('priority')}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-input border border-[#E5E5EA] bg-[#F5F5F5] p-2.5 text-center">
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor }} />
                  <span className="text-[11px] font-semibold" style={{ color: priorityColor }}>{task.priority}</span>
                </button>
                {/* Due Date chip */}
                <button type="button" onClick={() => setSubSheet('datetime')}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-input border p-2.5 text-center relative',
                    dueDateInfo ? 'border-[#3B82F6]/40 bg-[#3B82F6]/8' : 'border-[#E5E5EA] bg-[#F5F5F5]'
                  )}>
                  <Calendar size={14} className={dueDateInfo ? 'text-[#3B82F6]' : 'text-[#6C6C70]'} />
                  <span className="text-[11px] font-medium" style={{ color: dueDateInfo ? dueDateInfo.color : '#1C1C1E' }}>
                    {dueDateInfo ? dueDateInfo.label : 'Due Date'}
                  </span>
                  {dueDateInfo && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); save({ dueDate: undefined, dueTime: undefined }); }}
                      className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-[#3B82F6]/60 hover:text-[#EF4444] leading-none text-[14px]"
                    >×</span>
                  )}
                </button>
                {/* Repeat chip */}
                <button type="button" onClick={() => setSubSheet('recurring')}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-input border p-2.5 text-center',
                    recurringActive ? 'border-[#3B82F6]/40 bg-[#3B82F6]/8' : 'border-[#E5E5EA] bg-[#F5F5F5]'
                  )}>
                  <Repeat size={14} className={recurringActive ? 'text-[#3B82F6]' : 'text-[#6C6C70]'} />
                  <span className={cn('text-[11px] font-medium', recurringActive ? 'text-[#3B82F6]' : 'text-[#1C1C1E]')}>{recurringLabel}</span>
                </button>
                {/* Reminder chip */}
                <button type="button" onClick={() => setSubSheet('reminder')}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1.5 rounded-input border p-2.5 text-center',
                    reminderActive ? 'border-[#3B82F6]/40 bg-[#3B82F6]/8' : 'border-[#E5E5EA] bg-[#F5F5F5]'
                  )}>
                  <Bell size={14} className={reminderActive ? 'text-[#3B82F6]' : 'text-[#6C6C70]'} />
                  <span className={cn('text-[11px] font-medium', reminderActive ? 'text-[#3B82F6]' : 'text-[#1C1C1E]')}>{reminderLabel}</span>
                </button>
              </div>
            );
          })()}

          {/* Bottom buttons */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#E5E5EA]">
            <Button size="sm" variant="secondary" fullWidth onClick={handleDuplicate}>Duplicate</Button>
            <Button size="sm" variant="danger" fullWidth onClick={() => setDeleteConfirmOpen(true)}>Delete</Button>
          </div>

          <input ref={fileInputRef} type="file" className="hidden" />
        </div>
      </Modal>

      {/* Sub-sheet: Realm */}
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

      {/* Sub-sheet: Target */}
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
            {realmProjects.map((p) => (
              <button key={p.id} type="button"
                onClick={async () => { setSubSheet(null); await save({ targetId: p.id, projectId: p.id }); }}
                className={cn('flex items-center gap-3 py-3 px-2 rounded-card hover:bg-[#F5F5F5] transition-colors',
                  (task.targetId === p.id || task.projectId === p.id) && 'bg-[#F5F5F5]')}>
                <span className="flex-1 text-sm text-[#1C1C1E]">{p.title}</span>
                {(task.targetId === p.id || task.projectId === p.id) && <Check size={16} className="text-[#3B82F6]" />}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Sub-sheet: Priority */}
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
