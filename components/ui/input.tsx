import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const INPUT_BASE_CLASSES =
  "h-11 w-full min-w-0 rounded-md border-[1.5px] border-input bg-transparent px-3 py-1 text-base font-medium shadow-card transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/20 dark:disabled:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

interface InputProps extends React.ComponentProps<"input"> {
  /** Optional leading icon rendered inside the field, e.g. a Pencil or User icon from lucide-react */
  icon?: React.ReactNode
}

function Input({ className, type, icon, ...props }: InputProps) {
  if (icon) {
    return (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:w-4 [&_svg]:h-4">
          {icon}
        </span>
        <InputPrimitive
          type={type}
          data-slot="input"
          className={cn(INPUT_BASE_CLASSES, "pl-9", className)}
          {...props}
        />
      </div>
    )
  }

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(INPUT_BASE_CLASSES, className)}
      {...props}
    />
  )
}

export { Input }
