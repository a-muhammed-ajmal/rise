'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Goal, JournalEntry } from '@/lib/types/database'
import { todayISO, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, BookOpen, Loader2, ChevronRight } from 'lucide-react'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Great' },
  { value: 5, emoji: '🤩', label: 'Amazing' },
]

export default function GoalsPage() {
  const [tab, setTab] = useState<'goals' | 'journal'>('goals')
  const [goals, setGoals] = useState<Goal[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [goalOpen, setGoalOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const today = todayISO()
    const [{ data: gs }, { data: es }, { data: te }] = await Promise.all([
      supabase.from('goals').select('*').order('created_at', { ascending: false }),
      supabase.from('journal_entries').select('*').order('date', { ascending: false }).limit(20),
      supabase.from('journal_entries').select('*').eq('date', today).maybeSingle(),
    ])
    setGoals(gs ?? [])
    setEntries(es ?? [])
    setTodayEntry(te ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function updateProgress(goalId: string, progress: number) {
    const supabase = createClient()
    await supabase.from('goals').update({ progress, status: progress === 100 ? 'completed' : 'active' }).eq('id', goalId)
    await fetchData()
  }

  const active = goals.filter((g) => g.status === 'active')
  const completed = goals.filter((g) => g.status === 'completed')

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
        <h1 className="text-xl font-bold">Goals</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setJournalOpen(true)} className="gap-1.5">
            <BookOpen className="w-4 h-4" /> Journal
          </Button>
          <Button size="sm" onClick={() => { setEditGoal(null); setGoalOpen(true) }} className="gap-1.5">
            <Plus className="w-4 h-4" /> Goal
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="goals" className="flex-1">Goals ({active.length})</TabsTrigger>
          <TabsTrigger value="journal" className="flex-1">Journal</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'goals' && (
        <div className="space-y-3">
          {active.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="text-4xl">🎯</div>
              <p className="text-muted-foreground text-sm">No active goals. Set one to get started.</p>
            </div>
          ) : (
            active.map((goal) => (
              <Card key={goal.id} className="cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => { setEditGoal(goal); setGoalOpen(true) }}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{goal.title}</p>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">{goal.category}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                  {goal.target_date && (
                    <p className="text-xs text-muted-foreground">Target: {formatDate(goal.target_date)}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          {completed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed</p>
              {completed.map((goal) => (
                <Card key={goal.id} className="opacity-60">
                  <CardContent className="p-3 flex items-center justify-between">
                    <p className="text-sm line-through">{goal.title}</p>
                    <Badge className="text-xs">✓ Done</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'journal' && (
        <div className="space-y-3">
          {!todayEntry ? (
            <Card className="border-dashed cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setJournalOpen(true)}>
              <CardContent className="p-6 text-center space-y-2">
                <div className="text-3xl">✍️</div>
                <p className="text-sm text-muted-foreground">No journal entry for today. Write one?</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm">Today</CardTitle>
                <div className="flex items-center gap-2">
                  {todayEntry.mood && <span className="text-xl">{MOODS.find((m) => m.value === todayEntry.mood)?.emoji}</span>}
                  <Button size="sm" variant="ghost" onClick={() => setJournalOpen(true)}>Edit</Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap line-clamp-5">{todayEntry.content}</p>
              </CardContent>
            </Card>
          )}

          {entries.filter((e) => e.date !== todayISO()).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-muted-foreground">{formatDate(entry.date)}</p>
                  {entry.mood && <span className="text-lg">{MOODS.find((m) => m.value === entry.mood)?.emoji}</span>}
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-3">{entry.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditGoal(null); setGoalOpen(true) }}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-40"
        aria-label="Add goal"
      >
        <Plus className="w-6 h-6" />
      </button>

      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} goal={editGoal} onSaved={fetchData} onUpdateProgress={updateProgress} />
      <JournalDialog open={journalOpen} onOpenChange={setJournalOpen} existing={todayEntry} onSaved={fetchData} />
    </div>
  )
}

// ─── Goal Dialog ──────────────────────────────────────────────────────────────

function GoalDialog({ open, onOpenChange, goal, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; goal: Goal | null
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Goal['category']>('personal')
  const [targetDate, setTargetDate] = useState('')
  const [progress, setProgress] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (goal) {
      setTitle(goal.title)
      setDescription(goal.description ?? '')
      setCategory(goal.category)
      setTargetDate(goal.target_date ?? '')
      setProgress(goal.progress)
    } else {
      setTitle(''); setDescription(''); setCategory('personal'); setTargetDate(''); setProgress(0)
    }
  }, [goal, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const supabase = createClient()
    if (goal) {
      await supabase.from('goals').update({ title, description: description || null, category, target_date: targetDate || null, progress }).eq('id', goal.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('goals').insert({ user_id: user.id, title, description: description || null, category, target_date: targetDate || null, progress, status: 'active' as const })
    }
    setSaving(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{goal ? 'Edit Goal' : 'New Goal'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="What do you want to achieve?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Why does this matter?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Goal['category'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['personal','professional','health','financial','other'].map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          {goal && (
            <div className="space-y-2">
              <Label>Progress: {progress}%</Label>
              <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : goal ? 'Update' : 'Create Goal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Journal Dialog ───────────────────────────────────────────────────────────

function JournalDialog({ open, onOpenChange, existing, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; existing: JournalEntry | null; onSaved: () => void
}) {
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (existing) {
      setContent(existing.content)
      setMood(existing.mood)
      setEnergy(existing.energy)
    } else {
      setContent(''); setMood(null); setEnergy(null)
    }
  }, [existing, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const today = todayISO()
    await supabase.from('journal_entries').upsert({
      user_id: user.id,
      date: today,
      content,
      mood,
      energy,
      tags: [],
    })
    setSaving(false)
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Today&apos;s Journal</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>How are you feeling?</Label>
            <div className="flex gap-2 flex-wrap">
              {MOODS.map((m) => (
                <button key={m.value} type="button" onClick={() => setMood(m.value)}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-colors ${mood === m.value ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-accent'}`}>
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Write your thoughts</Label>
            <Textarea
              placeholder="What happened today? What are you grateful for? What could have gone better?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
