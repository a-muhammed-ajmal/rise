'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { type PomodoroSettings, type PomodoroType } from '@/lib/types';
import { LS_KEYS } from '@/lib/constants';
import { createDoc } from '@/lib/firestore';
import { COLLECTIONS } from '@/lib/constants';

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreak: false,
  autoStartWork: false,
};

function loadSettings(): PomodoroSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(LS_KEYS.POMODORO_SETTINGS);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: PomodoroSettings) {
  localStorage.setItem(LS_KEYS.POMODORO_SETTINGS, JSON.stringify(settings));
}

export function usePomodoroTimer(userId: string, linkedTaskId?: string) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [sessionType, setSessionType] = useState<PomodoroType>('work');
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setTimeLeft(s.workDuration * 60);
  }, []);

  const getDuration = useCallback(
    (type: PomodoroType): number => {
      if (type === 'work') return settings.workDuration * 60;
      if (type === 'short-break') return settings.shortBreakDuration * 60;
      return settings.longBreakDuration * 60;
    },
    [settings]
  );

  const saveSession = useCallback(
    async (completed: boolean) => {
      if (!userId || !startTimeRef.current) return;
      await createDoc(COLLECTIONS.POMODORO_SESSIONS, {
        userId,
        taskId: linkedTaskId,
        startedAt: startTimeRef.current,
        duration: settings.workDuration,
        type: sessionType,
        completed,
      });
    },
    [userId, linkedTaskId, sessionType, settings.workDuration]
  );

  const nextSession = useCallback(
    (completed: boolean) => {
      if (sessionType === 'work') {
        saveSession(completed);
        const newCount = sessionsCompleted + 1;
        setSessionsCompleted(newCount);
        const nextType: PomodoroType =
          newCount % settings.sessionsBeforeLongBreak === 0
            ? 'long-break'
            : 'short-break';
        setSessionType(nextType);
        setTimeLeft(getDuration(nextType));
        if (settings.autoStartBreak) setIsRunning(true);
        else setIsRunning(false);
      } else {
        setSessionType('work');
        setTimeLeft(getDuration('work'));
        if (settings.autoStartWork) setIsRunning(true);
        else setIsRunning(false);
      }
      startTimeRef.current = null;
    },
    [sessionType, sessionsCompleted, settings, getDuration, saveSession]
  );

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) startTimeRef.current = new Date().toISOString();
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            nextSession(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, nextSession]);

  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);

  const reset = () => {
    setIsRunning(false);
    startTimeRef.current = null;
    setTimeLeft(getDuration(sessionType));
  };

  const skip = () => {
    setIsRunning(false);
    nextSession(false);
  };

  const updateSettings = (newSettings: PomodoroSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setIsRunning(false);
    setTimeLeft(newSettings.workDuration * 60);
    setSessionType('work');
    setSessionsCompleted(0);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    settings,
    sessionType,
    timeLeft,
    display,
    isRunning,
    sessionsCompleted,
    start,
    pause,
    reset,
    skip,
    updateSettings,
  };
}
