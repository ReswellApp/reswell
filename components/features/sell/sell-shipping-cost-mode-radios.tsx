"use client"

import { useEffect, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { SmoothCollapse } from "@/components/ui/smooth-collapse"
import { SellReswellCalculatedShippingDetails } from "@/components/features/sell/sell-reswell-calculated-shipping-details"
import type { SellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { cn } from "@/lib/utils"

type SellShippingCostModeRadiosProps = {
  idPrefix: string
  value: SellShippingCostMode
  onChange: (mode: SellShippingCostMode) => void
  /**
   * @deprecated Free/flat are shown to all sellers. Kept for call-site compat; ignored.
   */
  allowPrivilegedModes?: boolean
  /**
   * When false, Reswell (UPS-calculated) cannot be selected — free/flat remain available
   * for sellers who ship with another carrier.
   */
  reswellAvailable?: boolean
  flatRateSlot?: ReactNode
  /** Origin + package summary shown under the Reswell calculated option. */
  reswellDetails?: {
    originCity?: string
    originState?: string
    packageLengthIn?: string
    packageWidthIn?: string
    packageHeightIn?: string
    packageWeightLb?: string
    packageWeightOz?: string
  }
  /** Packed size/weight fields nested under the Reswell option. */
  reswellPackageSlot?: ReactNode
}

const FREE_FLAT_FULFILLMENT_HINT =
  "After the sale, buy a Reswell shipping label or add your own tracking."

export function SellShippingCostModeRadios({
  idPrefix,
  value,
  onChange,
  reswellAvailable = true,
  flatRateSlot,
  reswellDetails,
  reswellPackageSlot,
}: SellShippingCostModeRadiosProps) {
  const reswellEnabled = reswellAvailable !== false
  const effectiveValue = (() => {
    if (!reswellEnabled && value === "reswell") return "flat"
    return value
  })()

  useEffect(() => {
    if (reswellEnabled) return
    if (value !== "reswell") return
    onChange("flat")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when mode/availability changes
  }, [reswellEnabled, value])

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground sm:text-base">
          How will you handle shipping costs in the Continental U.S.?
        </h4>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground sm:px-2.5 sm:text-[10px]">
          Required
        </span>
      </div>

      <RadioGroup
        value={effectiveValue}
        onValueChange={(next) => {
          const mode = next as SellShippingCostMode
          if (mode === "reswell" && !reswellEnabled) return
          onChange(mode)
        }}
        className="space-y-2 sm:space-y-3"
      >
        <div
          className={cn(
            "flex gap-2.5 rounded-lg border p-3 transition-colors sm:gap-3 sm:rounded-xl sm:p-5",
            !reswellEnabled && "opacity-60",
            effectiveValue === "reswell"
              ? "border-foreground bg-background shadow-sm"
              : "border-border hover:border-foreground/30",
          )}
        >
          <RadioGroupItem
            value="reswell"
            id={`${idPrefix}-ship-mode-reswell`}
            className="mt-0.5"
            disabled={!reswellEnabled}
          />
          <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
            <label
              htmlFor={`${idPrefix}-ship-mode-reswell`}
              className={cn(
                "flex flex-wrap items-center gap-1.5 sm:gap-2",
                reswellEnabled ? "cursor-pointer" : "cursor-not-allowed",
              )}
            >
              <span className="text-xs font-semibold leading-snug text-foreground sm:text-sm">
                Have Reswell calculate the shipping cost for buyers
              </span>
              <Badge
                variant="default"
                className="h-auto shrink-0 border-0 bg-listingHeart px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170] sm:px-2 sm:py-0.5 sm:text-[10px]"
              >
                Recommended
              </Badge>
            </label>
            <SmoothCollapse
              open={effectiveValue === "reswell" && reswellEnabled}
              className="duration-200"
            >
              <SellReswellCalculatedShippingDetails
                originCity={reswellDetails?.originCity}
                originState={reswellDetails?.originState}
                packageLengthIn={reswellDetails?.packageLengthIn}
                packageWidthIn={reswellDetails?.packageWidthIn}
                packageHeightIn={reswellDetails?.packageHeightIn}
                packageWeightLb={reswellDetails?.packageWeightLb}
                packageWeightOz={reswellDetails?.packageWeightOz}
                packageSlot={reswellPackageSlot}
              />
            </SmoothCollapse>
            {!reswellEnabled ? (
              <p className="text-xs leading-snug text-destructive sm:text-sm sm:leading-relaxed">
                Not available — this board exceeds UPS size limits. Use free or flat-rate shipping
                with another carrier instead.
              </p>
            ) : null}
          </div>
        </div>

        <label
          htmlFor={`${idPrefix}-ship-mode-free`}
          className={cn(
            "flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors sm:gap-3 sm:rounded-xl sm:p-5",
            effectiveValue === "free"
              ? "border-foreground bg-background shadow-sm"
              : "border-border hover:border-foreground/30",
          )}
        >
          <RadioGroupItem value="free" id={`${idPrefix}-ship-mode-free`} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
            <span className="text-xs font-semibold leading-snug text-foreground sm:text-sm">
              Offer free shipping
            </span>
            <SmoothCollapse open={effectiveValue === "free"} className="duration-200">
              <p className="pt-0.5 text-xs leading-snug text-muted-foreground sm:pt-1 sm:text-sm sm:leading-relaxed">
                Buyer pays $0 for shipping at checkout. {FREE_FLAT_FULFILLMENT_HINT}
              </p>
            </SmoothCollapse>
          </div>
        </label>

        <label
          htmlFor={`${idPrefix}-ship-mode-flat`}
          className={cn(
            "flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors sm:gap-3 sm:rounded-xl sm:p-5",
            effectiveValue === "flat"
              ? "border-foreground bg-background shadow-sm"
              : "border-border hover:border-foreground/30",
          )}
        >
          <RadioGroupItem value="flat" id={`${idPrefix}-ship-mode-flat`} className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
            <span className="text-xs font-semibold leading-snug text-foreground sm:text-sm">
              Set a flat shipping rate
            </span>
            <SmoothCollapse open={effectiveValue === "flat"} className="duration-200">
              <p className="pt-0.5 text-xs leading-snug text-muted-foreground sm:pt-1 sm:text-sm sm:leading-relaxed">
                One dollar amount buyers in the Continental U.S. pay at checkout.{" "}
                {FREE_FLAT_FULFILLMENT_HINT}
              </p>
            </SmoothCollapse>
          </div>
        </label>
      </RadioGroup>

      {flatRateSlot ? (
        <SmoothCollapse open={effectiveValue === "flat"}>
          <div className="pt-1">{flatRateSlot}</div>
        </SmoothCollapse>
      ) : null}
    </div>
  )
}
