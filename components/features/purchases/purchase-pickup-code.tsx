import {
  pickupCodeBannerLabelClassName,
  pickupCodeBannerSurfaceClassName,
} from "@/components/features/purchases/purchase-brand-styles"
import { cn } from "@/lib/utils"

interface PurchasePickupCodeProps {
  pickupCode: string
  /** Compact block for the purchases list. Full banner is for purchase details. */
  compact?: boolean
}

export function PurchasePickupCode({ pickupCode, compact = false }: PurchasePickupCodeProps) {
  if (compact) {
    return (
      <div className={cn("mt-2 rounded-lg border px-3 py-2", pickupCodeBannerSurfaceClassName)}>
        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", pickupCodeBannerLabelClassName)}>
          Pickup code
        </p>
        <p className="select-all font-mono text-lg font-bold tracking-[0.25em] text-foreground">{pickupCode}</p>
      </div>
    )
  }

  return (
    <section className={cn("rounded-xl border px-4 py-4 text-center", pickupCodeBannerSurfaceClassName)}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider", pickupCodeBannerLabelClassName)}>
        Your pickup code
      </p>
      <p className="mt-1 select-all font-mono text-3xl font-bold tracking-[0.3em] text-foreground">{pickupCode}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Show this code to the seller when you pick up the item. It confirms the handoff and releases their payout.
      </p>
    </section>
  )
}
