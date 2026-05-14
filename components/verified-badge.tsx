import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Pair with `<Badge variant="outline" className={verifiedSellerBadgeClassName}>` and {@link VerifiedBadge}. */
export const verifiedSellerBadgeClassName = cn(
  "gap-1 border-[#7F9DD5]/35 bg-[#7F9DD5]/11 text-[#7F9DD5] hover:bg-[#7F9DD5]/16",
  "dark:border-[#7F9DD5]/32 dark:bg-[#7F9DD5]/13 dark:text-[#7F9DD5] dark:hover:bg-[#7F9DD5]/20",
)

interface VerifiedBadgeProps {
  className?: string
  /** "sm" = 3.5 (inline with text), "md" = 4 (cards/detail), "lg" = 5 (profile header) */
  size?: "sm" | "md" | "lg"
}

const sizes = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
}

export function VerifiedBadge({ className, size = "md" }: VerifiedBadgeProps) {
  return (
    <CheckCircle2
      className={cn("shrink-0 fill-[#7F9DD5] text-white", sizes[size], className)}
      aria-label="Verified seller"
    />
  )
}
