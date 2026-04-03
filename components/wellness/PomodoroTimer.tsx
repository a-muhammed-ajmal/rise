'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, Settings, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDocument } from '@/lib/firestore';
import type { PomodoroSession, PomodoroSettings, PomodoroType } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ChangeEvent } from 'react';

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreak: false,
  autoStartWork: false,
};

const STORAGE_KEY = 'rise-pomodoro-settings';

function loadSettings(): PomodoroSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: PomodoroSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

interface PomodoroTimerProps {
  userId: string;
}

export default function PomodoroTimer({ userId }: PomodoroTimerProps) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [timerType, setTimerType] = useState<PomodoroType>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0); // completed work sessions
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const startedAtRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setSettingsForm(s);
    setTimeLeft(s.workDuration * 60);
  }, []);

  const getDuration = useCallback((type: PomodoroType, s: PomodoroSettings) => {
    switch (type) {
      case 'work': return s.workDuration * 60;
      case 'short-break': return s.shortBreakDuration * 60;
      case 'long-break': return s.longBreakDuration * 60;
    }
  }, []);

  const totalDuration = getDuration(timerType, settings);

  // Timer tick
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Handle timer completion
  useEffect(() => {
    if (timeLeft !== 0 || isRunning === false) return;
    // timeLeft just hit 0 while running
    setIsRunning(false);

    // Save completed session to Firestore
    if (startedAtRef.current) {
      addDocument('pomodoro-sessions', {
        startedAt: startedAtRef.current,
        duration: totalDuration,
        type: timerType,
        completed: true,
      } as Partial<PomodoroSession>, userId).catch(console.error);
      startedAtRef.current = null;
    }

    if (timerType === 'work') {
      const newCount = sessionCount + 1;
      setSessionCount(newCount);

      // Determine next break type
      const nextType: PomodoroType =
        newCount % settings.sessionsBeforeLongBreak === 0 ? 'long-break' : 'short-break';
      setTimerType(nextType);
      setTimeLeft(getDuration(nextType, settings));

      if (settings.autoStartBreak) {
        startedAtRef.current = new Date().toISOString();
        setIsRunning(true);
      }
    } else {
      // Break finished, go back to work
      setTimerType('work');
      setTimeLeft(getDuration('work', settings));

      if (settings.autoStartWork) {
        startedAtRef.current = new Date().toISOString();
        setIsRunning(true);
      }
    }
  }, [timeLeft, isRunning, timerType, sessionCount, settings, totalDuration, getDuration, userId]);

  const handleStart = () => {
    if (!isRunning) {
      if (!startedAtRef.current) {
        startedAtRef.current = new Date().toISOString();
      }
      setIsRunning(true);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    startedAtRef.current = null;
    setTimeLeft(getDuration(timerType, settings));
  };

  const switchMode = (type: PomodoroType) => {
    setIsRunning(false);
    startedAtRef.current = null;
    setTimerType(type);
    setTimeLeft(getDuration(type, settings));
  };

  const handleSaveSettings = () => {
    const validated: PomodoroSettings = {
      workDuration: Math.max(1, Math.min(120, settingsForm.workDuration || 25)),
      shortBreakDuration: Math.max(1, Math.min(60, settingsForm.shortBreakDuration || 5)),
      longBreakDuration: Math.max(1, Math.min(60, settingsForm.longBreakDuration || 15)),
      sessionsBeforeLongBreak: Math.max(1, Math.min(10, settingsForm.sessionsBeforeLongBreak || 4)),
      autoStartBreak: settingsForm.autoStartBreak,
      autoStartWork: settingsForm.autoStartWork,
    };
    setSettings(validated);
    saveSettings(validated);

    // Reset timer if not running
    if (!isRunning) {
      setTimeLeft(getDuration(timerType, validated));
    }
    setSettingsOpen(false);
  };

  // Format time
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Progress for ring (1 = full, 0 = empty)
  const progress = totalDuration > 0 ? timeLeft / totalDuration : 0;

  // Ring SVG params
  const ringSize = 180;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const isWork = timerType === 'work';
  const accentColor = isWork ? '#FF9933' : '#10B981';
  const currentSessionDisplay = Math.min(sessionCount + 1, settings.sessionsBeforeLongBreak);

  return (
    <>
      <div className="bg-surface-2 rounded-2xl border border-border p-6 mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Timer size={20} style={{ color: accentColor }} />
            <h2 className="text-lg font-bold text-text">Pomodoro Timer</h2>
          </div>
          <button
            onClick={() => { setSettingsForm(settings); setSettingsOpen(true); }}
            className="p-2 text-text-3 hover:text-text hover:bg-surface-3 rounded-lg transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { type: 'work' as PomodoroType, label: 'Work' },
            { type: 'short-break' as PomodoroType, label: 'Short Break' },
            { type: 'long-break' as PomodoroType, label: 'Long Break' },
          ]).map(({ type, label }) => (
            <button
              key={type}
              onClick={() => switchMode(type)}
              className={cn(
                'flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors',
                timerType === type
                  ? type === 'work'
                    ? 'bg-rise/15 text-rise'
                    : 'bg-green-500/15 text-green-500'
                  : 'text-text-3 hover:bg-surface-3'
              )}
            >
              {type !== 'work' && <Coffee size={14} className="inline mr-1 -mt-0.5" />}
              {label}
            </button>
          ))}
        </div>

        {/* Timer Ring */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="transform -rotate-90">
              {/* Background ring */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                className="text-border"
                strokeWidth={strokeWidth}
              />
              {/* Progress ring */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={accentColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            {/* Time display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-text tabular-nums">{display}</span>
              <span className="text-xs text-text-3 mt-1 capitalize">
                {timerType === 'work' ? 'Focus' : timerType === 'short-break' ? 'Short Break' : 'Long Break'}
              </span>
            </div>
          </div>
        </div>

        {/* Session Counter */}
        <div className="text-center text-sm text-text-3 mb-4">
          Session {currentSessionDisplay} of {settings.sessionsBeforeLongBreak}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleReset}
            className="p-3 rounded-xl text-text-3 hover:text-text hover:bg-surface-3 transition-colors"
            title="Reset"
          >
            <RotateCcw size={20} />
          </button>

          <button
            onClick={isRunning ? handlePause : handleStart}
            className={cn(
              'p-4 rounded-2xl text-white shadow-sm transition-colors',
              isWork
                ? 'bg-rise hover:bg-rise/90'
                : 'bg-green-500 hover:bg-green-600'
            )}
            title={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} />}
          </button>

          {/* Spacer to balance the reset button */}
          <div className="w-11" />
        </div>
      </div>

      {/* Settings Modal */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Pomodoro Settings">
        <div className="space-y-4">
          <Input
            label="Work Duration (minutes)"
            type="number"
            min={1}
            max={120}
            value={settingsForm.workDuration}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSettingsForm({ ...settingsForm, workDuration: Number(e.target.value) })
            }
          />
          <Input
            label="Short Break (minutes)"
            type="number"
            min={1}
            max={60}
            value={settingsForm.shortBreakDuration}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSettingsForm({ ...settingsForm, shortBreakDuration: Number(e.target.value) })
            }
          />
          <Input
            label="Long Break (minutes)"
            type="number"
            min={1}
            max={60}
            value={settingsForm.longBreakDuration}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSettingsForm({ ...settingsForm, longBreakDuration: Number(e.target.value) })
            }
          />
          <Input
            label="Sessions Before Long Break"
            type="number"
            min={1}
            max={10}
            value={settingsForm.sessionsBeforeLongBreak}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSettingsForm({ ...settingsForm, sessionsBeforeLongBreak: Number(e.target.value) })
            }
          />

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.autoStartBreak}
                onChange={(e) => setSettingsForm({ ...settingsForm, autoStartBreak: e.target.checked })}
                className="w-4 h-4 rounded accent-rise"
              />
              <span className="text-sm text-text">Auto-start breaks</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.autoStartWork}
                onChange={(e) => setSettingsForm({ ...settingsForm, autoStartWork: e.target.checked })}
                className="w-4 h-4 rounded accent-rise"
              />
              <span className="text-sm text-text">Auto-start work sessions</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} className="flex-1">
              Save Settings
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
