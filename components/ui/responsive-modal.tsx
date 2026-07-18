'use client'

import * as React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useIsDesktop } from '@/lib/hooks/use-is-desktop'
import { cn } from '@/lib/utils'

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** Extra classes for the content container (applied to both shells). */
  className?: string
  /** Accessible label — used when the content has no visible dialog title. */
  ariaLabel?: string
}

/**
 * Renders a bottom sheet on mobile (< md) and a centered modal on desktop (≥ md),
 * per the TaskFlow spec. Both shells wrap the same @base-ui dialog primitive and
 * are controlled identically via `open` / `onOpenChange`, so the caller composes
 * one set of header / scroll-body / footer children that works in either.
 *
 * Mobile: rounded-top sheet with a grab handle, up to 92vh tall.
 * Desktop: centered, max-width 520px, max-height 85vh, scrollable body.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  children,
  className,
  ariaLabel,
}: ResponsiveModalProps) {
  const isDesktop = useIsDesktop()

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          aria-label={ariaLabel}
          showCloseButton={false}
          className={cn(
            'sm:max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0',
            className
          )}
        >
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-label={ariaLabel}
        showCloseButton={false}
        className={cn(
          'max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0',
          className
        )}
      >
        <div
          className="mx-auto mt-2 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
          aria-hidden="true"
        />
        {children}
      </SheetContent>
    </Sheet>
  )
}
