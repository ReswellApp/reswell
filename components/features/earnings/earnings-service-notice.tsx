import { Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

/** End of November 18, 2026 in Pacific time. */
const NOTICE_ENDS_AT_MS = Date.parse("2026-11-19T08:00:00.000Z")

export function EarningsServiceNotice() {
  if (Date.now() >= NOTICE_ENDS_AT_MS) return null

  return (
    <Alert className="rounded-2xl border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/50 dark:text-amber-50 [&>svg]:text-amber-800 dark:[&>svg]:text-amber-200">
      <Info className="h-4 w-4" aria-hidden />
      <AlertDescription className="text-amber-950/90 dark:text-amber-50/90">
        This should be working by the end of the day on November 18. In the meantime, please bear
        with us. We apologize for the inconvenience.
      </AlertDescription>
    </Alert>
  )
}
