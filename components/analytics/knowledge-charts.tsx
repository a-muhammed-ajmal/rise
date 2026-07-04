"use client"

import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const KNOWLEDGE_COLOR = "#D97706"  // --mod-knowledge (Amber)
const LINK_COLORS = ["#2563EB", "#059669", "#7C3AED", "#9CA3AF"]
const TAG_COLORS = ["#D97706", "#2563EB", "#059669", "#F59E0B", "#7C3AED", "#9CA3AF"]

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
}

export interface KnowledgeChartsProps {
  notesPerDay: { date: string; count: number }[]
  byLinkedType: { type: string; count: number }[]
  topTags: { tag: string; count: number }[]
  totalNotes: number
  totalLinks: number
  totalDocs: number
}

export function KnowledgeCharts({
  notesPerDay,
  byLinkedType,
  topTags,
  totalNotes,
  totalLinks,
  totalDocs,
}: KnowledgeChartsProps) {
  const isEmpty = totalNotes === 0 && totalLinks === 0 && totalDocs === 0

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No knowledge items yet
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Summary stat tiles */}
      <Card className="md:col-span-2">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold font-mono text-violet-500">{totalNotes}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Notes</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-blue-400">{totalLinks}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Saved Links</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-emerald-400">{totalDocs}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Documents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes created per day — last 14 days */}
      {notesPerDay.some((d) => d.count > 0) && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes Created — Last 14 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={notesPerDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), "Notes"]} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Notes"
                  stroke={KNOWLEDGE_COLOR}
                  strokeWidth={2}
                  dot={{ fill: KNOWLEDGE_COLOR, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Notes by linked type */}
      {byLinkedType.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes Linked To</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byLinkedType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {byLinkedType.map((_, i) => (
                    <Cell key={i} fill={LINK_COLORS[i % LINK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), undefined]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top tags */}
      {topTags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topTags} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="tag"
                  width={80}
                  tick={{ fontSize: 11, fill: "var(--foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), "Notes"]} />
                <Bar dataKey="count" name="Notes" radius={[0, 4, 4, 0]}>
                  {topTags.map((_, i) => (
                    <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
