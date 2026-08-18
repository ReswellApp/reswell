import { PRICE_GUIDE_CONFIDENCE_HINT, PRICE_GUIDE_CONFIDENCE_LABEL } from "@/lib/price-guide/format"
import type { PriceGuideConfidence } from "@/lib/types/price-guide"
import { cn } from "@/lib/utils"

const TONE: Record<PriceGuideConfidence, string> = {
  thin: "border-border/80 bg-muted/40 text-muted-foreground",
  emerging: "border-amber-200 bg-amber-50 text-amber-900",
  solid: "border-emerald-200 bg-emerald-50 text-emerald-900",
  expert: "border-foreground/20 bg-foreground text-background",
}

type PriceGuideConfidencePillProps = {
  confidence: PriceGuideConfidence
  showHint?: boolean
  className?: string
}

export function PriceGuideConfidencePill({
  confidence,
  showHint = false,
  className,
}: PriceGuideConfidencePillProps) {
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
          TONE[confidence],
        )}
      >
        {PRICE_GUIDE_CONFIDENCE_LABEL[confidence]}
      </span>
      {showHint ? (
        <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {PRICE_GUIDE_CONFIDENCE_HINT[confidence]}
        </span>
      ) : null}
    </span>
  )
}
