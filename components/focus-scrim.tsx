"use client"

import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export type FocusScrimProps = {
  open: boolean
  onDismiss: () => void
  /** Accessible label for the dismiss control. */
  ariaLabel?: string
  className?: string
}

/**
 * Soft page dimmer that draws attention to a focused control (nav search, sell jumpstart).
 * Portaled to `document.body` so it is not trapped by the site header’s stacking context.
 * Default `z-40` sits below the site header (`z-[60]`) and sell focus stages (`z-50`).
 */
export function FocusScrim({
  open,
  onDismiss,
  ariaLabel = "Dismiss",
  className,
}: FocusScrimProps) {
  if (!open || typeof document === "undefined") return null

  return createPortal(
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-0 z-40 cursor-default border-0 bg-foreground/30 p-0",
        "animate-in fade-in-0 duration-200 motion-reduce:animate-none",
        "supports-[backdrop-filter]:backdrop-blur-[1px]",
        className,
      )}
      onClick={onDismiss}
    />,
    document.body,
  )
}
