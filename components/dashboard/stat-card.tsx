import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type StatAccent = "tasks" | "wellness" | "goals" | "finance" | "danger"

// Tailwind can't compile dynamic class names — tones must be static strings.
// The tone class drives the tile's accent rule, wash, border, shadow, icon
// chip, value colour and progress bar (app/globals.css, "Home accents").
const TONE: Record<StatAccent, string> = {
  tasks: "tone-tasks",
  wellness: "tone-wellness",
  goals: "tone-goals",
  finance: "tone-finance",
  danger: "tone-danger",
}

type StatCardProps = {
  href: string
  label: string
  /** Pre-formatted display value, e.g. "4", "2/5", "12,346" */
  value: string
  /** Small unit shown before the value, e.g. "AED" */
  prefix?: string
  /** "amount" sizes the value down on phones so an exact AED figure fits a third-width tile */
  valueSize?: "metric" | "amount"
  icon: LucideIcon
  accent: StatAccent
  /** Small context line under the value, e.g. "2 overdue" */
  context?: string
  contextTone?: "muted" | "danger"
  /** 0–100 — renders a thin progress bar instead of the context line */
  progress?: number
  className?: string
}

export function StatCard({
  href,
  label,
  value,
  icon: Icon,
  accent,
  prefix,
  valueSize = "metric",
  context,
  contextTone = "muted",
  progress,
  className,
}: StatCardProps) {
  return (
    <Link href={href} className={cn("block h-full min-w-0", className)}>
      <Card
        size="sm"
        className={cn(
          "home-stat h-full cursor-pointer py-3 md:py-4",
          TONE[accent],
        )}
      >
        <CardContent className="px-3 md:px-4 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-label font-medium text-muted-foreground">
              {label}
            </p>
            <span
              className="home-chip flex size-6 shrink-0 items-center justify-center rounded-md"
              aria-hidden="true"
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <p
            className={cn(
              valueSize === "amount" ? "text-base" : "text-h1",
              "home-stat__value md:text-metric font-semibold tabular-nums break-words",
            )}
          >
            {prefix && (
              <span className="text-label font-medium text-muted-foreground">
                {prefix}{" "}
              </span>
            )}
            {value}
          </p>
          {typeof progress === "number" ? (
            <Progress
              value={progress}
              className="h-1.5"
              aria-label={`${label} progress`}
            />
          ) : context ? (
            <p
              className={cn(
                "text-label leading-snug break-words",
                contextTone === "danger"
                  ? "text-destructive font-medium"
                  : "text-muted-foreground",
              )}
            >
              {context}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}
