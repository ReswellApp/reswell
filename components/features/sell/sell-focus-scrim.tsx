"use client"

import { FocusScrim, type FocusScrimProps } from "@/components/focus-scrim"

export type SellFocusScrimProps = FocusScrimProps

/**
 * Soft page dimmer for sell jumpstart flows (catalog search, photo assist).
 * Not a modal — click or Escape (handled by the parent) dismisses.
 * Renders below the site header (`z-50`) so nav stays usable.
 */
export function SellFocusScrim({
  open,
  onDismiss,
  className,
  ariaLabel = "Dismiss focused search",
}: SellFocusScrimProps) {
  return (
    <FocusScrim
      open={open}
      onDismiss={onDismiss}
      ariaLabel={ariaLabel}
      className={className}
    />
  )
}
