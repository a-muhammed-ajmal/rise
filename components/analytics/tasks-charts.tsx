"use client"

import { useEffect, useState } from "react"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export type TaskStatus = "inbox" | "todo" | "in_progress" | "done"
export type TaskPriority = "P1" | "P2" | "P3" | "P4"

export interface ByStatusItem {
  status: TaskStatus
  count: number
}

export interface ByPriorityItem {
  priority: TaskPriority
  count: number
}

export interface CompletedPerDayItem {
  date: string
  count: number
}

export interface TasksChartsProps {
  byStatus: ByStatusItem[]
  byPriority: ByPriorityItem[]
  completedPerDay: CompletedPerDayItem[]
  loading?: boolean
  error?: string | null
  daysRange?: number
}

const CHART_HEIGHT_PIE = 220
const CHART_HEIGHT_BAR = 240
const CHART_HEIGHT_LINE = 260
const PIE_INNER_RADIUS = 50
const PIE_OUTER_RADIUS = 80
const PIE_PADDING_ANGLE = 3

const STATUS_COLORS: Record<TaskStatus, string> = {
  inbox: "hsl(var(--muted-foreground))",
  todo: "hsl(var(--primary))",
  in_progress: "hsl(var(--destructive))",
  done: "hsl(var(--chart-2, 142 76% 36%))",
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  P1: "#EF4444",
  P2: "#FF6535",
  P3: "#3B82F6",
  P4: "hsl(var(--muted-foreground))",
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  P1: "Urgent",
  P2: "High",
  P3: "Medium",
  P4: "Low",
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
  padding: "8px 10px",
} as const

const formatShortDate = (isoOrDate: string | number | Date) => {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return String(isoOrDate)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const formatFullDate = (isoOrDate: string | number | Date) => {
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return String(isoOrDate)
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

const sumCounts = (items: { count: number }[]) => items.reduce((s, it) => s + (it?.count ?? 0), 0)

function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
}

function CustomTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  title,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ name?: string | number; dataKey?: unknown; value?: unknown }>
  label?: string | number
  labelFormatter?: (label: string | number) => string
  valueFormatter?: (value: unknown, name: string) => [string, string]
  title?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div style={TOOLTIP_STYLE}>
      {title ? (
        <div style={{ fontSize: 12, marginBottom: 6, color: "hsl(var(--muted-foreground))" }}>
          {title}
        </div>
      ) : label !== undefined ? (
        <div style={{ fontSize: 12, marginBottom: 6, color: "hsl(var(--muted-foreground))" }}>
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      ) : null}
      {payload.map((p, i) => {
        const name = String(p.name ?? p.dataKey ?? "")
        const value = p.value
        const [formattedValue, formattedName] = valueFormatter
          ? valueFormatter(value, name)
          : [String(value ?? 0), name]

        return (
          <div key={`${name}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ color: "hsl(var(--foreground))" }}>{formattedName}</div>
            <div style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>{formattedValue}</div>
          </div>
        )
      })}
    </div>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefersReducedMotion(Boolean(mq.matches))

    update()

    if (mq.addEventListener) {
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }

    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  return prefersReducedMotion
}

export function TasksCharts({
  byStatus,
  byPriority,
  completedPerDay,
  loading = false,
  error = null,
  daysRange,
}: TasksChartsProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  const sortedCompletedPerDay = [...completedPerDay].sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    return da - db
  })

  const hasStatusData = byStatus.length > 0 && !byStatus.every((s) => (s.count ?? 0) === 0)
  const hasPriorityData = byPriority.length > 0 && !byPriority.every((p) => (p.count ?? 0) === 0)
  const hasCompletedData =
    sortedCompletedPerDay.length > 0 && !sortedCompletedPerDay.every((d) => (d.count ?? 0) === 0)

  const totalTasks = sumCounts(byStatus)
  const totalCompleted = sumCounts(sortedCompletedPerDay)

  const numericFormatter = (value: unknown) => {
    const n = Number(value ?? 0)
    return n.toLocaleString()
  }

  const statusAriaLabel = `Tasks by status. Total ${totalTasks} tasks.`
  const priorityAriaLabel = `Tasks by priority.`
  const completedAriaLabel = daysRange
    ? `Tasks completed over the last ${daysRange} days. Total completed ${totalCompleted}.`
    : `Tasks completed over time. Total completed ${totalCompleted}.`

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Tasks by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[180px] w-full" />
            </div>
          ) : error ? (
            <EmptyState message={String(error)} />
          ) : !hasStatusData ? (
            <EmptyState message="No tasks yet" />
          ) : (
            <div className="relative" role="group" aria-label={statusAriaLabel}>
              <div style={{ width: "100%", height: CHART_HEIGHT_PIE }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer>
                    <Pie
                      data={byStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={PIE_INNER_RADIUS}
                      outerRadius={PIE_OUTER_RADIUS}
                      paddingAngle={PIE_PADDING_ANGLE}
                      isAnimationActive={!prefersReducedMotion}
                      labelLine={false}
                    >
                      {byStatus.map((entry, i) => (
                        <Cell key={`${entry.status}-${i}`} fill={STATUS_COLORS[entry.status]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          title="Tasks by Status"
                          valueFormatter={(value, name) => [
                            numericFormatter(value),
                            STATUS_LABELS[name as TaskStatus] ?? name,
                          ]}
                        />
                      )}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value: string) => STATUS_LABELS[value as TaskStatus] ?? value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-base font-semibold text-foreground">{totalTasks.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Tasks</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Tasks by Priority</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[180px] w-full" />
            </div>
          ) : error ? (
            <EmptyState message={String(error)} />
          ) : !hasPriorityData ? (
            <EmptyState message="No tasks yet" />
          ) : (
            <div role="group" aria-label={priorityAriaLabel}>
              <div style={{ width: "100%", height: CHART_HEIGHT_BAR }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byPriority}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="priority"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => PRIORITY_LABELS[v as TaskPriority] ?? String(v)}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          label={label}
                          title="Tasks by Priority"
                          valueFormatter={(value) => [numericFormatter(value), "Tasks"]}
                        />
                      )}
                    />
                    <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]} isAnimationActive={!prefersReducedMotion}>
                      {byPriority.map((entry, i) => (
                        <Cell
                          key={`${entry.priority}-${i}`}
                          fill={PRIORITY_COLORS[entry.priority]}
                        />
                      ))}
                      <LabelList dataKey="count" position="top" fill="hsl(var(--foreground))" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            {daysRange ? `Tasks Completed — Last ${daysRange} Days` : "Tasks Completed — Recent Activity"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          ) : error ? (
            <EmptyState message={String(error)} />
          ) : !hasCompletedData ? (
            <EmptyState message="No completed tasks yet" />
          ) : (
            <div role="group" aria-label={completedAriaLabel}>
              <div style={{ width: "100%", height: CHART_HEIGHT_LINE }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sortedCompletedPerDay}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(0, Math.floor((sortedCompletedPerDay.length || 1) / 7))}
                      tickFormatter={(v) => formatShortDate(v)}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <CustomTooltip
                          active={active}
                          payload={payload}
                          label={label}
                          labelFormatter={(lbl) => formatFullDate(lbl)}
                          title="Tasks Completed"
                          valueFormatter={(value) => [numericFormatter(value), "Completed"]}
                        />
                      )}
                    />
                    <Line
                      type={prefersReducedMotion ? "linear" : "monotone"}
                      dataKey="count"
                      name="Completed"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeLinecap="round"
                      connectNulls
                      dot={{ r: 4, fill: "hsl(var(--primary))" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TasksCharts