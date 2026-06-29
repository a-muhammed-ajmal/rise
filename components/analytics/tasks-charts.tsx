"use client"

import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const TASKS_COLOR = "#34D399"  // --mod-tasks (Green)

const STATUS_COLORS: Record<string, string> = {
  inbox:       "#94A3B8",  // --mod-knowledge Silver — parked
  todo:        "#60A5FA",  // --mod-finance Blue — pending
  in_progress: "#FBBF24",  // --mod-wellness Amber — active
  done:        "#34D399",  // --mod-tasks Green — complete
}
const PRIORITY_COLORS: Record<string, string> = {
  low:    "#94A3B8",  // Silver — low urgency
  medium: "#60A5FA",  // Blue — moderate
  high:   "#FBBF24",  // Amber — high
  urgent: "#F87171",  // --color-danger Red — critical
}

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
}

export interface TasksChartsProps {
  byStatus: { status: string; count: number }[]
  byPriority: { priority: string; count: number }[]
  completedPerDay: { date: string; count: number }[]
}

export function TasksCharts({ byStatus, byPriority, completedPerDay }: TasksChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Task status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tasks by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {byStatus.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] ?? TASKS_COLOR} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), undefined]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Task priority */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tasks by Priority</CardTitle>
        </CardHeader>
        <CardContent>
          {byPriority.every(p => p.count === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPriority} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="priority" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), "Tasks"]} />
                <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]}>
                  {byPriority.map((entry, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[entry.priority] ?? TASKS_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Completed per day */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Completed — Last 14 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completedPerDay} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), "Completed"]} />
              <Line type="monotone" dataKey="count" name="Completed" stroke={TASKS_COLOR} strokeWidth={2} dot={{ r: 3, fill: TASKS_COLOR }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
