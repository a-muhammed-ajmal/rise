'use client'

import { useState } from 'react'
import { useTasks } from '@/lib/hooks/use-tasks'
import { TaskCard } from '@/components/productivity/task-card'
import { TaskForm } from '@/components/productivity/task-form'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Inbox, CalendarDays, List, Loader2 } from 'lucide-react'

type Filter = 'inbox' | 'today' | 'all'

export default function ProductivityPage() {
  const [filter, setFilter] = useState<Filter>('inbox')
  const [newOpen, setNewOpen] = useState(false)
  const { tasks, loading, createTask, updateTask, completeTask, deleteTask } = useTasks(filter)

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tasks</h1>
        <Button onClick={() => setNewOpen(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full">
          <TabsTrigger value="inbox" className="flex-1 gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="today" className="flex-1 gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Today
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 gap-1.5">
            <List className="w-3.5 h-3.5" />
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <div className="text-4xl">✅</div>
          <p className="text-muted-foreground text-sm">
            {filter === 'inbox'
              ? 'Your inbox is empty.'
              : filter === 'today'
              ? 'Nothing due today!'
              : 'No active tasks.'}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setNewOpen(true)}>
            + Add a task
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={completeTask}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          ))}
          <p className="text-xs text-center text-muted-foreground pt-2">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <TaskForm
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={createTask}
      />

      {/* FAB for mobile */}
      <button
        onClick={() => setNewOpen(true)}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-40"
        aria-label="Add task"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}
