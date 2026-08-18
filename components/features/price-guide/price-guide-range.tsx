import { formatGuideUsd, formatGuideUsdRange } from "@/lib/price-guide/format"
import type { PriceGuideTypicalRange } from "@/lib/types/price-guide"
import { cn } from "@/lib/utils"

type PriceGuideRangeProps = {
  typical: PriceGuideTypicalRange
  size?: "lg" | "md"
  className?: string
}

export function PriceGuideRange({ typical, size = "md", className }: PriceGuideRangeProps) {
  const hasRange = typical.low_usd != null || typical.mid_usd != null || typical.high_usd != null

  return (
    <div className={cn(className)}>
      <p
        className={cn(
          "font-semibold tracking-tight text-foreground tabular-nums",
          size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl",
        )}
      >
        {typical.mid_usd != null ? formatGuideUsd(typical.mid_usd) : formatGuideUsdRange(typical.low_usd, typical.high_usd)}
      </p>
      {hasRange && typical.mid_usd != null ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Typical range {formatGuideUsdRange(typical.low_usd, typical.high_usd)}
        </p>
      ) : null}
      {typical.new_retail_usd != null ? (
        <p className="mt-1 text-xs text-muted-foreground">
          New retail {formatGuideUsd(typical.new_retail_usd)}
        </p>
      ) : null}
    </div>
  )
}

export function PriceGuideRangeBar({ typical }: { typical: PriceGuideTypicalRange }) {
  if (typical.low_usd == null || typical.high_usd == null || typical.high_usd <= typical.low_usd) {
    return null
  }
  const span = typical.high_usd - typical.low_usd
  const mid = typical.mid_usd ?? (typical.low_usd + typical.high_usd) / 2
  const midPct = Math.min(100, Math.max(0, ((mid - typical.low_usd) / span) * 100))

  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-muted">
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
          style={{ left: `${midPct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatGuideUsd(typical.low_usd)}</span>
        <span>{formatGuideUsd(typical.high_usd)}</span>
      </div>
    </div>
  )
}
