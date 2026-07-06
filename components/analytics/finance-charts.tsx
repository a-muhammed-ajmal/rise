"use client"

import { useState } from "react"
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const INCOME_COLOR = "#10B981"
const EXPENSE_COLOR = "#E11D48"
const PIE_COLORS = ["#2563EB", "#059669", "#F59E0B", "#7C3AED", "#0891B2", "#9CA3AF"]

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
}

type FlowEntry = { label: string; income: number; expense: number }

export interface FinanceChartsProps {
  monthlyFlow: { month: string; income: number; expense: number }[]
  dailyFlow: { date: string; income: number; expense: number }[]
  categorySpend: { category: string; amount: number }[]
  budgetActual: { category: string; budget: number; actual: number }[]
}

export function FinanceCharts({ monthlyFlow, dailyFlow, categorySpend, budgetActual }: FinanceChartsProps) {
  const [flowView, setFlowView] = useState<"monthly" | "daily">("monthly")

  const flowData: FlowEntry[] = flowView === "monthly"
    ? monthlyFlow.map((d) => ({ label: d.month, income: d.income, expense: d.expense }))
    : dailyFlow.map((d) => ({ label: d.date, income: d.income, expense: d.expense }))
  const flowLabel = flowView === "monthly" ? "Income vs Expenses — Last 6 Months" : "Income vs Expenses — Last 30 Days"

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Income vs Expense trend */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{flowLabel}</CardTitle>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setFlowView("monthly")}
                className={`px-2.5 py-1 transition-colors ${flowView === "monthly" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setFlowView("daily")}
                className={`px-2.5 py-1 transition-colors ${flowView === "daily" ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
              >
                Daily
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={flowData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={INCOME_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={INCOME_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={EXPENSE_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval={flowView === "daily" ? 4 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: unknown) => [`AED ${Number(value ?? 0).toLocaleString()}`, undefined]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="income" name="Income" stroke={INCOME_COLOR} fill="url(#incomeGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke={EXPENSE_COLOR} fill="url(#expenseGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Spending by category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {categorySpend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No expense data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categorySpend}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {categorySpend.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`AED ${Number(value ?? 0).toLocaleString()}`, undefined]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Budget vs Actual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Budget vs Actual — This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {budgetActual.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No budgets set</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetActual} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`AED ${Number(value ?? 0).toLocaleString()}`, undefined]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="budget" name="Budget" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
