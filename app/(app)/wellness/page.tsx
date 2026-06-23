'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Habit, HabitLog } from '@/lib/types/database'
import { todayISO } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Flame, Timer, CheckCircle, Circle, Loader2 } from 'lucide-react'
import { subDays, format } from 'date-fns'

export default function WellnessPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [newHabitOpen, setNewHabitOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const today = todayISO()
  const todayDow = new Date().getDay()

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const last30 = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const [{ data: hs }, { data: ls }] = await Promise.all([
      supabase.from('habits').select('*').eq('active', true).order('created_at'),
      supabase.from('habit_logs').select('*').gte('logged_date', last30),
    ])
    setHabits(hs ?? [])
    setLogs(ls ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleHabit(habitId: string, done: boolean) {
    const supabase = createClient()
    if (done) {
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('logged_date', today)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('habit_logs').upsert({ user_id: user.id, habit_id: habitId, logged_date: today, completed: true })
    }
    await fetchData()
  }

  function getStreak(habitId: string): number {
    const doneDays = new Set(
      logs.filter((l) => l.habit_id === habitId && l.completed).map((l) => l.logged_date)
    )
    let streak = 0
    let d = new Date()
    while (true) {
      const key = format(d, 'yyyy-MM-dd')
      if (doneDays.has(key)) {
        streak++
        d = subDays(d, 1)
      } else {
        break
      }
    }
    return streak
  }

  const todayHabits = habits.filter((h) => h.target_days.includes(todayDow))
  const todayLogs = new Set(logs.filter((l) => l.logged_date === today && l.completed).map((l) => l.habit_id))
  const completedToday = todayHabits.filter((h) => todayLogs.has(h.id)).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Wellness</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setFocusOpen(true)} className="gap-1.5">
            <Timer className="w-4 h-4" /> Focus
          </Button>
          <Button size="sm" onClick={() => setNewHabitOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Habit
          </Button>
        </div>
      </div>

      {/* Today summary */}
      {todayHabits.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Today&apos;s habits</span>
              <span className="text-muted-foreground">{completedToday}/{todayHabits.length}</span>
            </div>
            <Progress value={todayHabits.length > 0 ? (completedToday / todayHabits.length) * 100 : 0} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Habit list */}
      <div className="space-y-2">
        {habits.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="text-4xl">🌱</div>
            <p className="text-muted-foreground text-sm">No habits yet. Add one to get started.</p>
          </div>
        ) : (
          habits.map((habit) => {
            const isDueToday = habit.target_days.includes(todayDow)
            const doneTodayFlag = todayLogs.has(habit.id)
            const streak = getStreak(habit.id)

            return (
              <Card key={habit.id} className={doneTodayFlag ? 'opacity-75' : ''}>
                <CardContent className="p-4 flex items-center gap-3">
                  {isDueToday ? (
                    <button
                      onClick={() => toggleHabit(habit.id, doneTodayFlag)}
                      className="shrink-0 transition-transform active:scale-95"
                      aria-label={doneTodayFlag ? 'Undo' : 'Complete'}
                    >
                      {doneTodayFlag
                        ? <CheckCircle className="w-7 h-7 text-emerald-500" />
                        : <Circle className="w-7 h-7 text-muted-foreground" />
                      }
                    </button>
                  ) : (
                    <span className="w-7 h-7 flex items-center justify-center shrink-0 text-muted-foreground/40">
                      <Circle className="w-7 h-7" />
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{habit.icon}</span>
                      <span className={`text-sm font-medium ${doneTodayFlag ? 'line-through text-muted-foreground' : ''}`}>
                        {habit.name}
                      </span>
                    </div>
                    {!isDueToday && (
                      <p className="text-xs text-muted-foreground">Not due today</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {streak > 0 && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Flame className="w-3 h-3 text-orange-500" />
                        {streak}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setNewHabitOpen(true)}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-40"
        aria-label="Add habit"
      >
        <Plus className="w-6 h-6" />
      </button>

      <NewHabitDialog open={newHabitOpen} onOpenChange={setNewHabitOpen} onSaved={fetchData} />
      <FocusTimerDialog open={focusOpen} onOpenChange={setFocusOpen} />
    </div>
  )
}

// ─── New Habit Dialog ─────────────────────────────────────────────────────────

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const ICONS = ['⭐','💪','📚','🧘','🏃','💧','🥗','😴','✍️','🎯','🎨','🎵']

function NewHabitDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('⭐')
  const [targetDays, setTargetDays] = useState([0,1,2,3,4,5,6])
  const [saving, setSaving] = useState(false)

  function toggleDay(d: number) {
    setTargetDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || targetDays.length === 0) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('habits').insert({
      user_id: user.id,
      name: name.trim(),
      description: null,
      icon,
      color: '#6366f1',
      frequency: targetDays.length === 7 ? 'daily' : 'custom',
      target_days: targetDays,
      active: true,
    })
    setSaving(false)
    setName(''); setIcon('⭐'); setTargetDays([0,1,2,3,4,5,6])
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Habit</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input placeholder="e.g. Morning run" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button key={ic} type="button" onClick={() => setIcon(ic)}
                  className={`text-xl p-1.5 rounded-lg transition-colors ${ic === icon ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-accent'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Repeat on</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={d} type="button" onClick={() => toggleDay(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${targetDays.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Habit'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Focus Timer Dialog ───────────────────────────────────────────────────────

function FocusTimerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [minutes, setMinutes] = useState(25)
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)

  useEffect(() => {
    if (!running) return
    if (secondsLeft <= 0) { setRunning(false); return }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [running, secondsLeft])

  function start() { setSecondsLeft(minutes * 60); setRunning(true) }
  function pause() { setRunning(false) }
  function reset() { setRunning(false); setSecondsLeft(minutes * 60) }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const pct = ((minutes * 60 - secondsLeft) / (minutes * 60)) * 100

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setRunning(false); setSecondsLeft(minutes * 60) }; onOpenChange(v) }}>
      <DialogContent className="sm:max-w-xs text-center">
        <DialogHeader><DialogTitle>Focus Timer</DialogTitle></DialogHeader>
        <div className="space-y-6 py-4">
          <div className="relative w-40 h-40 mx-auto">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-primary"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - pct / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-mono font-bold">{mm}:{ss}</span>
            </div>
          </div>
          {!running && (
            <div className="flex justify-center gap-2">
              {[15,25,45,60].map((m) => (
                <button key={m} onClick={() => { setMinutes(m); setSecondsLeft(m * 60) }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${minutes === m ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}>
                  {m}m
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3">
            {!running
              ? <Button onClick={start} className="w-24">Start</Button>
              : <><Button onClick={pause} variant="outline" className="w-24">Pause</Button>
                 <Button onClick={reset} variant="ghost" className="w-24">Reset</Button></>
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
