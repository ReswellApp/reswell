"use client"

import { useEffect, useState } from "react"
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
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timeout = window.setTimeout(() => setMounted(false), 280)
    return () => window.clearTimeout(timeout)
  }, [open])

  if (!mounted || typeof document === "undefined") return null

  return createPortal(
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-0 z-40 cursor-default border-0 bg-foreground/30 p-0",
        "transition-opacity duration-300 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
        "supports-[backdrop-filter]:backdrop-blur-[1px]",
        className,
      )}
      onClick={onDismiss}
    />,
    document.body,
  )
}
