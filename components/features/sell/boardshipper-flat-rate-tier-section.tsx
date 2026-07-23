"use client"

import { cn } from "@/lib/utils"
import {
  BOARDSHIPPER_FLAT_RATES_USD,
  BOARDSHIPPER_ZONE_LABELS,
  type BoardShipperZone,
} from "@/lib/shipping/boardshipper-flat-rates"
import {
  surfboardShippingTierHeadline,
  SURFBOARD_SHIPPING_TIER_IDS,
  getSurfboardShippingTier,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const PREVIEW_ZONES: BoardShipperZone[] = [
  "california",
  "or_wa_co",
  "hawaii",
  "rest_of_us",
  "canada",
  "europe",
]

export interface BoardShipperFlatRateTierSectionProps {
  className?: string
  value: SurfboardShippingTierId | ""
  onChange: (tierId: SurfboardShippingTierId) => void
}

export function BoardShipperFlatRateTierSection({
  className,
  value,
  onChange,
}: BoardShipperFlatRateTierSectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground/45 leading-relaxed">
        Choose the BoardShipper size tier for this board. Buyers pay the flat rate for their
        destination at checkout — rates include pickup and insurance up to $750.
      </p>

      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as SurfboardShippingTierId)}
        className="space-y-3"
      >
        {SURFBOARD_SHIPPING_TIER_IDS.map((tierId) => {
          const tier = getSurfboardShippingTier(tierId)
          const selected = value === tierId

          return (
            <label
              key={tierId}
              htmlFor={`sell-flat-tier-${tierId}`}
              className={cn(
                "block rounded-xl border cursor-pointer transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/35",
              )}
            >
              <div className="flex gap-3 p-4 sm:p-5">
                <RadioGroupItem
                  value={tierId}
                  id={`sell-flat-tier-${tierId}`}
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
                    <div className="rounded-lg border border-border/80 bg-background px-4 py-3.5 overflow-x-auto">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/45">
                        BoardShipper flat rates (2026)
                      </p>
                      <table className="mt-2 w-full min-w-[280px] text-sm">
                        <tbody>
                          {PREVIEW_ZONES.map((zone) => {
                            const rate = BOARDSHIPPER_FLAT_RATES_USD[tierId][zone]
                            return (
                              <tr key={zone} className="border-b border-border/50 last:border-0">
                                <td className="py-1.5 pr-4 text-muted-foreground/70">
                                  {BOARDSHIPPER_ZONE_LABELS[zone]}
                                </td>
                                <td className="py-1.5 text-right font-medium tabular-nums text-foreground">
                                  {rate != null ? `$${rate}` : "Quote on request"}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <p className="mt-2 text-xs text-muted-foreground/45 leading-relaxed">
                        Hawaii: local warehouse pickup. Domestic longboards (Rest of US): airport
                        pickup. International: door-to-door or airport pickup — contact BoardShipper
                        for customs clearance.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </label>
          )
        })}
      </RadioGroup>

      {!value ? (
        <p className="text-sm text-muted-foreground/45">
          Select a shipping size to publish with BoardShipper flat rates.
        </p>
      ) : null}
    </div>
  )
}
