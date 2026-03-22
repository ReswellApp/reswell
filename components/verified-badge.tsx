import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
      className={cn("shrink-0 fill-black text-white", sizes[size], className)}
      aria-label="Verified seller"
    />
  )
}
