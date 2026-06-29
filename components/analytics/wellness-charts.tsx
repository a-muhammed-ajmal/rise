"use client"

import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const WELLNESS_COLOR = "#FBBF24"  // --mod-wellness (Amber)
const TASKS_COLOR = "#34D399"     // --mod-tasks (Green)
const MOOD_COLOR = "#F472B6"      // --mod-goals (Pink)

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
}

const MOOD_LABELS: Record<number, string> = { 1: "Rough", 2: "Okay", 3: "Good", 4: "Great", 5: "Amazing" }

export interface WellnessChartsProps {
  habitRates: { name: string; icon: string; rate: number }[]
  moodTrend: { date: string; mood: number }[]
  focusMinutes: { date: string; minutes: number }[]
}

export function WellnessCharts({ habitRates, moodTrend, focusMinutes }: WellnessChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Habit completion rates */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Habit Completion Rate — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {habitRates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active habits tracked</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={habitRates} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "var(--foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`${Number(value ?? 0)}%`, "Completion"]} />
                <Bar dataKey="rate" name="Completion %" fill={WELLNESS_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Mood trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Daily Mood — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {moodTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No journal entries with mood yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => MOOD_LABELS[v] ?? String(v)} width={48} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => { const n = Number(value ?? 0); return [MOOD_LABELS[n] ?? String(n), "Mood"] }} />
                <Line type="monotone" dataKey="mood" stroke={MOOD_COLOR} strokeWidth={2} dot={{ r: 3, fill: MOOD_COLOR }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Focus minutes per day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Focus Minutes — Last 14 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={focusMinutes} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`${Number(value ?? 0)} min`, "Focus"]} />
              <Bar dataKey="minutes" name="Minutes" fill={TASKS_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
