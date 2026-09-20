import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type StatAccent = "tasks" | "wellness" | "goals" | "finance" | "danger"

// Tailwind can't compile dynamic class names — accents must be static strings
const ACCENT: Record<StatAccent, { icon: string }> = {
  tasks: { icon: "text-mod-tasks" },
  wellness: { icon: "text-mod-wellness" },
  goals: { icon: "text-mod-goals" },
  finance: { icon: "text-mod-finance" },
  danger: { icon: "text-destructive" },
}

type StatCardProps = {
  href: string
  label: string
  /** Pre-formatted display value, e.g. "4", "2/5", "AED 145" */
  value: string
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
          "card-hover h-full cursor-pointer py-3 md:py-4",
        )}
      >
        <CardContent className="px-3 md:px-4 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-label font-medium text-muted-foreground">
              {label}
            </p>
            <Icon
              className={cn("w-3.5 h-3.5 shrink-0", ACCENT[accent].icon)}
              aria-hidden="true"
            />
          </div>
          <p className="text-h1 md:text-metric font-semibold tabular-nums">
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
