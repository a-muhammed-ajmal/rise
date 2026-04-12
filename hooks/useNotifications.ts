'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { where } from 'firebase/firestore';
import { subscribeToCollection } from '@/lib/firestore';
import { COLLECTIONS } from '@/lib/constants';
import type { Task, Habit } from '@/lib/types';

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function useNotifications(userId: string) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pendingCount, setPendingCount] = useState(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sync permission state from browser on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const fireNotification = useCallback(async (title: string, body: string, tag?: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const options: NotificationOptions = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag ?? `rise-notif-${Date.now()}`,
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        // showNotification on SW registration supports vibrate on Android
        await reg.showNotification(title, {
          ...options,
          // @ts-expect-error vibrate is valid in SW context
          vibrate: [200, 100, 200],
          requireInteraction: false,
        });
      } else {
        new Notification(title, options);
      }
    } catch {
      try {
        new Notification(title, options);
      } catch {
        /* silent fail */
      }
    }
  }, []);

  const scheduleNotification = useCallback(
    (key: string, title: string, body: string, fireAt: Date) => {
      const delay = fireAt.getTime() - Date.now();
      // Only schedule if within the next 24 hours and in the future
      if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;

      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);

      const t = setTimeout(() => {
        fireNotification(title, body, key);
        timers.current.delete(key);
      }, delay);
      timers.current.set(key, t);
    },
    [fireNotification]
  );

  // Always track pending tasks for today (drives the badge count)
  useEffect(() => {
    if (!userId) return;
    const todayStr = getTodayStr();

    const unsub = subscribeToCollection<Task>(
      COLLECTIONS.TASKS,
      userId,
      (tasks) => {
        const pending = tasks.filter(
          (t) => !t.isCompleted && (t.dueDate === todayStr || t.isMyDay)
        ).length;
        setPendingCount(pending);
      },
      [where('isCompleted', '==', false)]
    );

    return () => unsub();
  }, [userId]);

  // Schedule per-task notifications when permission is granted
  useEffect(() => {
    if (!userId || permission !== 'granted') return;

    const unsubTasks = subscribeToCollection<Task>(
      COLLECTIONS.TASKS,
      userId,
      (tasks) => {
        tasks.forEach((task) => {
          if (task.isCompleted || !task.dueDate || !task.dueTime) return;
          const dueAt = new Date(`${task.dueDate}T${task.dueTime}`);
          // Notify 5 minutes before due time
          const notifyAt = new Date(dueAt.getTime() - 5 * 60 * 1000);
          scheduleNotification(
            `task-${task.id}`,
            `⚡ Action Due: ${task.title}`,
            `Due at ${task.dueTime}`,
            notifyAt
          );
        });
      },
      [where('isCompleted', '==', false)]
    );

    const unsubHabits = subscribeToCollection<Habit>(
      COLLECTIONS.HABITS,
      userId,
      (habits) => {
        habits.forEach((habit) => {
          if (!habit.isActive || !habit.reminder?.enabled || !habit.reminder.time) return;
          const [hh, mm] = habit.reminder.time.split(':').map(Number);
          const notifyAt = new Date();
          notifyAt.setHours(hh, mm, 0, 0);
          scheduleNotification(
            `habit-${habit.id}`,
            `🔥 Rhythm Reminder: ${habit.name}`,
            `Time to complete your daily rhythm`,
            notifyAt
          );
        });
      },
      [where('isActive', '==', true)]
    );

    return () => {
      unsubTasks();
      unsubHabits();
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [userId, permission, scheduleNotification]);

  return { permission, pendingCount, requestPermission, fireNotification };
}
