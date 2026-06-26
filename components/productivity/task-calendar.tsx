'use client'

import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types/database'
import { TaskCard } from './task-card'

const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-500',
  medium: 'bg-blue-500',
  low:    'bg-slate-400',
}

interface TaskCalendarProps {
  tasks: Task[]
  onComplete: (id: string) => void
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>
  onDelete: (id: string) => void
  onDuplicate?: (id: string) => void
  onStar?: (id: string) => void
  projects?: Array<{ id: string; name: string; color: string }>
}

export function TaskCalendar({
  tasks,
  onComplete,
  onUpdate,
  onDelete,
  onDuplicate,
  onStar,
  projects = [],
}: TaskCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [viewDate])

  // Map tasks by due_date for quick lookup
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      if (!task.due_date) return
      const key = task.due_date // already YYYY-MM-DD
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    })
    return map
  }, [tasks])

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const selectedTasks = selectedDateStr ? (tasksByDate.get(selectedDateStr) ?? []) : []

  // Tasks with no due date
  const undatedTasks = tasks.filter((t) => !t.due_date)

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewDate(subMonths(viewDate, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold">
          {format(viewDate, 'MMMM yyyy')}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewDate(addMonths(viewDate, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const dayTasks = tasksByDate.get(dateStr) ?? []
          const isCurrentMonth = isSameMonth(day, viewDate)
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const isDayToday = isToday(day)

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={cn(
                'bg-card min-h-[4rem] p-1.5 flex flex-col items-start gap-1 text-left transition-colors hover:bg-accent/50',
                !isCurrentMonth && 'opacity-30',
                isSelected && 'bg-primary/10 hover:bg-primary/15',
              )}
            >
              {/* Day number */}
              <span className={cn(
                'text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center',
                isDayToday && 'bg-primary text-primary-foreground',
                isSelected && !isDayToday && 'text-primary font-bold',
                !isDayToday && !isSelected && 'text-foreground'
              )}>
                {format(day, 'd')}
              </span>

              {/* Task dots (max 3) */}
              <div className="flex flex-wrap gap-0.5">
                {dayTasks.slice(0, 4).map((task) => (
                  <span
                    key={task.id}
                    className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])}
                    title={task.title}
                  />
                ))}
                {dayTasks.length > 4 && (
                  <span className="text-[9px] text-muted-foreground leading-none">+{dayTasks.length - 4}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day tasks */}
      {selectedDate && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE, d MMMM')}
            </h3>
            <span className="text-xs text-muted-foreground">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No tasks due this day.</p>
          ) : (
            selectedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onStar={onStar}
                projects={projects}
              />
            ))
          )}
        </div>
      )}

      {/* Undated tasks */}
      {undatedTasks.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            No due date ({undatedTasks.length})
          </h3>
          {undatedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onStar={onStar}
              projects={projects}
            />
          ))}
        </div>
      )}
    </div>
  )
}
