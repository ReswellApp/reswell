import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Required-field indicator for sell forms: red asterisk while the field is
 * empty or invalid, swapped in place for a check in the same completion
 * accent as the section "Done" badges once the value is valid. Both glyphs
 * are the same visual size, so labels never shift.
 */
export function SellRequiredMark({
  complete,
  className,
}: {
  complete: boolean
  className?: string
}) {
  if (complete) {
    return (
      <Check
        className={cn(
          "inline-block h-3.5 w-3.5 -translate-y-px text-listingHeart",
          className,
        )}
        strokeWidth={3}
        aria-hidden="true"
      />
    )
  }
  return (
    <span className={cn("text-destructive", className)} aria-hidden="true">
      *
    </span>
  )
}
