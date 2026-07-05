import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type StatAccent = "tasks" | "wellness" | "goals" | "finance" | "danger"

// Tailwind can't compile dynamic class names — accents must be static strings
const ACCENT: Record<StatAccent, { border: string; icon: string }> = {
  tasks: { border: "border-t-mod-tasks", icon: "text-mod-tasks" },
  wellness: { border: "border-t-mod-wellness", icon: "text-mod-wellness" },
  goals: { border: "border-t-mod-goals", icon: "text-mod-goals" },
  finance: { border: "border-t-mod-finance", icon: "text-mod-finance" },
  danger: { border: "border-t-destructive", icon: "text-destructive" },
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
          "card-hover h-full cursor-pointer border-t-4 py-2.5 md:py-3",
          ACCENT[accent].border,
        )}
      >
        <CardContent className="px-2.5 md:px-3 space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <p className="text-micro uppercase tracking-wide text-muted-foreground truncate">
              {label}
            </p>
            <Icon
              className={cn("w-3.5 h-3.5 shrink-0", ACCENT[accent].icon)}
              aria-hidden="true"
            />
          </div>
          <p className="text-lg md:text-metric font-mono font-medium truncate">
            {value}
          </p>
          {typeof progress === "number" ? (
            <Progress
              value={progress}
              className="pt-1"
              aria-label={`${label} progress`}
            />
          ) : context ? (
            <p
              className={cn(
                "text-micro truncate",
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
