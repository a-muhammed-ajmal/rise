"use client"

import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatAED } from "@/lib/format"

const CRM_COLOR = "var(--mod-crm)"
const STAGE_COLORS: Record<string, string> = {
  new:         "var(--color-p4)",
  qualified:   "var(--color-info)",
  proposal:    "var(--color-warning)",
  negotiation: "var(--mod-knowledge)",
  won:         "var(--color-success)",
  lost:        "var(--color-danger)",
}
const TYPE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
}

export interface CrmChartsProps {
  byStage: { stage: string; count: number; value: number }[]
  byType: { type: string; count: number }[]
  recentActivity: { month: string; interactions: number }[]
}

export function CrmCharts({ byStage, byType, recentActivity }: CrmChartsProps) {
  const isEmpty = byStage.length === 0 && byType.length === 0

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No contacts added yet
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Pipeline by stage (bar) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Contacts by Pipeline Stage</CardTitle>
        </CardHeader>
        <CardContent>
          {byStage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No contacts yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStage} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: unknown, name: unknown) => [
                    name === "value" ? formatAED(Number(value ?? 0)) : Number(value ?? 0),
                    name === "value" ? "Pipeline Value" : "Contacts",
                  ]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Contacts" radius={[4, 4, 0, 0]}>
                  {byStage.map((entry, i) => (
                    <Cell key={i} fill={STAGE_COLORS[entry.stage] ?? CRM_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Contacts by type (donut) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Contacts by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {byType.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No contacts yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {byType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), undefined]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Interaction activity over last 6 months */}
      {recentActivity.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interaction Activity — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={recentActivity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [Number(value ?? 0), "Interactions"]} />
                <Bar dataKey="interactions" name="Interactions" fill={CRM_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
