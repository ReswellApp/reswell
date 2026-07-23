"use client"

import { cn } from "@/lib/utils"
import {
  SURFBOARD_SHIPPING_DIM_FORMULA,
} from "@/lib/shipping/surfboard-label-limits"
import {
  getSurfboardShippingTier,
  surfboardShippingTierCarrierDescription,
  surfboardShippingTierDimInFromSelection,
  surfboardShippingTierHeadline,
  surfboardShippingTierLimitDescription,
  surfboardShippingTierSummaryLine,
  surfboardShippingTierUsesUpsParcelLimits,
  SURFBOARD_SHIPPING_TIER_IDS,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { FedExMark, UpsMark } from "@/components/features/sell/carrier-mark-icons"

export interface SurfboardShippingTierPickerProps {
  className?: string
  value: SurfboardShippingTierId | ""
  onChange: (tierId: SurfboardShippingTierId) => void
}

export function SurfboardShippingTierPicker({
  className,
  value,
  onChange,
}: SurfboardShippingTierPickerProps) {
  const selectedTierId = value || null

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="text-sm text-muted-foreground/45 leading-relaxed">
          Pick the box size that matches how you&apos;ll ship this board. Reswell uses these fixed
          dimensions for checkout quotes and your shipping label — no tape measure needed.
        </p>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as SurfboardShippingTierId)}
        className="space-y-3"
      >
        {SURFBOARD_SHIPPING_TIER_IDS.map((tierId) => {
          const tier = getSurfboardShippingTier(tierId)
          const selected = value === tierId
          const dimIn = surfboardShippingTierDimInFromSelection(tierId)

          return (
            <label
              key={tierId}
              htmlFor={`sell-ship-tier-${tierId}`}
              className={cn(
                "block rounded-xl border cursor-pointer transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/35",
              )}
            >
              <div className="flex gap-3 p-4 sm:p-5">
                <RadioGroupItem
                  value={tierId}
                  id={`sell-ship-tier-${tierId}`}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tier.label}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground/90">
                      {surfboardShippingTierHeadline(tierId)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground/45 leading-relaxed">
                      {tier.summary}
                    </p>
                  </div>

                  {selected ? (
                    <div className="rounded-lg border border-border/80 bg-background px-4 py-3.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/45">
                        Packed box
                      </p>
                      <p className="mt-1 text-base font-semibold text-foreground tabular-nums">
                        {surfboardShippingTierSummaryLine(tierId)}
                      </p>
                      <p className="mt-2 text-sm tabular-nums text-foreground/80">
                        DIM {dimIn}″{" "}
                        <span className="text-muted-foreground/45">
                          ({SURFBOARD_SHIPPING_DIM_FORMULA};{" "}
                          {surfboardShippingTierLimitDescription(tier)})
                        </span>
                      </p>
                    </div>
                  ) : null}

                  {selected ? (
                    <div className="rounded-lg border border-border/80 bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-foreground/90">
                      {surfboardShippingTierUsesUpsParcelLimits(tierId) ? (
                        <>
                          <div className="flex gap-3">
                            <UpsMark className="mt-0.5" />
                            <p className="min-w-0">
                              <span className="sr-only">UPS. </span>
                              Shortboards ship via{" "}
                              <span className="font-semibold text-foreground">UPS</span> or{" "}
                              <span className="font-semibold text-foreground">FedEx</span> parcel
                              within UPS size limits.
                            </p>
                          </div>
                        </>
                      ) : (
                        <p>{surfboardShippingTierCarrierDescription(tierId)}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </label>
          )
        })}
      </RadioGroup>

      {selectedTierId ? null : (
        <p className="text-sm text-muted-foreground/45">
          Select a shipping size to continue with Reswell shipping.
        </p>
      )}
    </div>
  )
}
