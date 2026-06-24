"use client"

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

const INCOME_COLOR = "#10b981"   // --mod-finance
const EXPENSE_COLOR = "#f43f5e"  // --mod-wellness (red-ish)
const PIE_COLORS = ["#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA", "#5B21B6", "#5E6C7A"]

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
}

export interface FinanceChartsProps {
  monthlyFlow: { month: string; income: number; expense: number }[]
  categorySpend: { category: string; amount: number }[]
  budgetActual: { category: string; budget: number; actual: number }[]
}

export function FinanceCharts({ monthlyFlow, categorySpend, budgetActual }: FinanceChartsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Income vs Expense trend */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Income vs Expenses — Last 6 Months</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyFlow} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: unknown) => [`AED ${Number(value ?? 0).toLocaleString()}`, undefined]} />
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
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}`} />
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
