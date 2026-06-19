import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

type AuthTransitionShellProps = {
  className?: string
  /** Shown to screen readers; keep copy neutral (no "error" wording). */
  ariaLabel?: string
}

/**
 * Neutral full-viewport surface while auth completes (session sync, post-login redirect).
 * Avoids flashing login forms or error cards during successful sign-in.
 */
export function AuthTransitionShell({
  className,
  ariaLabel = "Signing you in",
}: AuthTransitionShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10",
        className,
      )}
      role="status"
      aria-label={ariaLabel}
    >
      <RefreshCw
        className="h-5 w-5 animate-spin text-muted-foreground/60"
        aria-hidden
      />
    </div>
  )
}
