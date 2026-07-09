import * as React from "react"

import { cn } from "@/lib/utils"

const TEXTAREA_BASE_CLASSES =
  "flex field-sizing-content min-h-16 w-full rounded-md border-[1.5px] border-input bg-transparent px-3 py-2 text-base font-medium shadow-card transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/20 dark:disabled:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Optional leading icon rendered inside the field, e.g. a Pencil icon from lucide-react */
  icon?: React.ReactNode
}

function Textarea({ className, icon, ...props }: TextareaProps) {
  if (icon) {
    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-3 text-muted-foreground [&_svg]:w-4 [&_svg]:h-4">
          {icon}
        </span>
        <textarea
          data-slot="textarea"
          className={cn(TEXTAREA_BASE_CLASSES, "pl-9", className)}
          {...props}
        />
      </div>
    )
  }

  return (
    <textarea
      data-slot="textarea"
      className={cn(TEXTAREA_BASE_CLASSES, className)}
      {...props}
    />
  )
}

export { Textarea }
