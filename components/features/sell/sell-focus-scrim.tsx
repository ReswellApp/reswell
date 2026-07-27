"use client"

import { cn } from "@/lib/utils"

export type SellFocusScrimProps = {
  open: boolean
  onDismiss: () => void
  className?: string
}

/**
 * Soft page dimmer for sell jumpstart flows (catalog search, photo assist).
 * Not a modal — click or Escape (handled by the parent) dismisses.
 * Renders below the site header (`z-50`) so nav stays usable.
 */
export function SellFocusScrim({ open, onDismiss, className }: SellFocusScrimProps) {
  if (!open) return null

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Dismiss focused search"
      className={cn(
        "fixed inset-0 z-40 cursor-default border-0 bg-foreground/30 p-0",
        "animate-in fade-in-0 duration-200 motion-reduce:animate-none",
        "supports-[backdrop-filter]:backdrop-blur-[1px]",
        className,
      )}
      onClick={onDismiss}
    />
  )
}
