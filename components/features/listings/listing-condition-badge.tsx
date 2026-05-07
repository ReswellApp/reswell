import { formatCondition } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"

const CONDITION_TONE: Record<string, string> = {
  brand_new: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/55",
  new: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/55",
  excellent: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/55",
  like_new: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/55",
  very_good: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-300 dark:border-emerald-900/55",
  good: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/35 dark:text-blue-300 dark:border-blue-900/55",
  fair: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/55",
  poor: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/55",
}

const NEW_CONDITIONS = new Set(["brand_new", "new"])

/** Reverb-template condition pill with optional "Used" qualifier (skipped on new boards). */
export function ListingConditionBadge({
  condition,
  className,
}: {
  condition: string | null | undefined
  className?: string
}) {
  const raw = (condition ?? "").trim()
  const label = formatCondition(raw)
  if (!label) return null
  const tone = CONDITION_TONE[raw] ?? CONDITION_TONE.good
  const isNew = NEW_CONDITIONS.has(raw)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
          tone,
        )}
      >
        {label}
      </span>
      {!isNew ? (
        <span className="text-sm text-muted-foreground">Used</span>
      ) : null}
    </div>
  )
}
