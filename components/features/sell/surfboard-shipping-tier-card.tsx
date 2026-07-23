import { cn } from "@/lib/utils"
import {
  SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
  SURFBOARD_SHIPPING_DIM_FORMULA,
} from "@/lib/shipping/surfboard-label-limits"
import {
  getSurfboardShippingTier,
  surfboardShippingTierDimInFromBoardLength,
  surfboardShippingTierHeadline,
  surfboardShippingTierLimitDescription,
  surfboardShippingTierSummaryLine,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import { FedExMark, UpsMark } from "@/components/features/sell/carrier-mark-icons"

export interface SurfboardShippingTierCardProps {
  className?: string
  tierId: SurfboardShippingTierId
  /** Bare board length from Dimensions — drives the packed-length estimate. */
  boardLength: string
}

export function SurfboardShippingTierCard({
  className,
  tierId,
  boardLength,
}: SurfboardShippingTierCardProps) {
  const tier = getSurfboardShippingTier(tierId)
  const dimIn = surfboardShippingTierDimInFromBoardLength(boardLength)

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/20 p-5 sm:p-6 space-y-4 shadow-sm",
        className,
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Shipping size estimate</h3>
        <p className="mt-1 text-sm font-medium text-foreground/90">{surfboardShippingTierHeadline(tierId)}</p>
        <p className="mt-1 text-sm text-muted-foreground/45 leading-relaxed">
          {SURFBOARD_SHIPPING_DIM_FORMULA}. Based on your board length, we use a standard{" "}
          <span className="font-medium text-foreground/80">{tier.label.toLowerCase()}</span> carton
          for carrier rates — no tape measure needed.
        </p>
      </div>

      <div className="rounded-lg border border-border/80 bg-background px-4 py-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/45">
          Estimated packed box
        </p>
        <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
          {surfboardShippingTierSummaryLine(tierId, boardLength)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground/45 leading-relaxed">{tier.summary}</p>
        {dimIn != null ? (
          <p className="mt-2 text-sm tabular-nums text-foreground/80">
            DIM {dimIn}″{" "}
            <span className="text-muted-foreground/45">
              ({SURFBOARD_SHIPPING_DIM_FORMULA}; {surfboardShippingTierLimitDescription(tier)})
            </span>
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground/90">
        <div className="flex gap-3">
          <UpsMark className="mt-0.5" />
          <p className="min-w-0">
            <span className="sr-only">UPS. </span>
            Many heavier or longer packed surfboards route{" "}
            <span className="font-semibold text-foreground">UPS</span> Ground.
          </p>
        </div>
        <div className="mt-3 flex gap-3">
          <FedExMark className="mt-0.5" />
          <p className="min-w-0">
            <span className="sr-only">FedEx. </span>
            <span className="font-semibold text-foreground">FedEx</span> often fits mid-size boards,
            faster options, or when it&apos;s the better rate for the lane.
          </p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground/45">
          Reswell picks the carrier at checkout from this estimate and the buyer&apos;s address.
          {SURFBOARD_SHIPPING_DIM_FORMULA} must be {SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}″ or
          less; weight 25 lb or less.
        </p>
      </div>
    </div>
  )
}
