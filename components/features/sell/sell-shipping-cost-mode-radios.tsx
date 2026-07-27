"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { SellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import { cn } from "@/lib/utils"

type SellShippingCostModeRadiosProps = {
  idPrefix: string
  value: SellShippingCostMode
  onChange: (mode: SellShippingCostMode) => void
  /** When false, only Reswell is shown (sellers). Admins see free + flat. */
  allowPrivilegedModes: boolean
  /**
   * When false, Reswell (UPS-calculated) cannot be selected — free/flat remain available
   * for admins who ship with another carrier.
   */
  reswellAvailable?: boolean
  flatRateSlot?: React.ReactNode
}

export function SellShippingCostModeRadios({
  idPrefix,
  value,
  onChange,
  allowPrivilegedModes,
  reswellAvailable = true,
  flatRateSlot,
}: SellShippingCostModeRadiosProps) {
  const reswellEnabled = reswellAvailable !== false
  const effectiveValue = (() => {
    if (!allowPrivilegedModes && (value === "free" || value === "flat")) return "reswell"
    // Oversize + Reswell selected → show free/flat selection surface instead of a dead Reswell radio.
    if (!reswellEnabled && value === "reswell" && allowPrivilegedModes) return "flat"
    return value
  })()

  // Keep parent form in sync when Reswell UPS is unavailable (avoid Save validating UPS DIM).
  useEffect(() => {
    if (!allowPrivilegedModes || reswellEnabled) return
    if (value !== "reswell") return
    onChange("flat")
    // Intentionally omit `onChange` — parent often passes an inline handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when mode/availability changes
  }, [allowPrivilegedModes, reswellEnabled, value])

  return (
    <div className="space-y-4">
      <RadioGroup
        value={effectiveValue}
        onValueChange={(next) => {
          const mode = next as SellShippingCostMode
          if (mode === "reswell" && !reswellEnabled) return
          onChange(mode)
        }}
        className="space-y-3"
      >
        <label
          htmlFor={`${idPrefix}-ship-mode-reswell`}
          className={cn(
            "flex gap-3 rounded-lg border p-4 transition-colors",
            reswellEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            effectiveValue === "reswell"
              ? "border-primary bg-primary/5"
              : "border-slate-300 hover:border-primary/35",
          )}
        >
          <RadioGroupItem
            value="reswell"
            id={`${idPrefix}-ship-mode-reswell`}
            className="mt-0.5"
            disabled={!reswellEnabled}
          />
          <div className="min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium leading-snug text-foreground">
                Reswell shipping (UPS)
              </span>
              <Badge
                variant="default"
                className="h-auto shrink-0 border-0 bg-listingHeart px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#2a4170]"
              >
                Recommended
              </Badge>
            </div>
            {effectiveValue === "reswell" && reswellEnabled ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                We calculate the UPS rate from packed dimensions and add it at checkout. After the
                sale we email you the Reswell shipping label.{" "}
                <Link
                  href="/terms"
                  className="text-foreground underline underline-offset-2 hover:text-primary"
                  onClick={(e) => e.stopPropagation()}
                >
                  View terms
                </Link>
              </p>
            ) : null}
            {!reswellEnabled ? (
              <p className="text-sm leading-relaxed text-destructive">
                Not available — this board exceeds UPS size limits. Use free or flat-rate shipping
                with another carrier instead.
              </p>
            ) : null}
          </div>
        </label>

        {allowPrivilegedModes ? (
          <>
            <label
              htmlFor={`${idPrefix}-ship-mode-free`}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                effectiveValue === "free"
                  ? "border-primary bg-primary/5"
                  : "border-slate-300 hover:border-primary/35",
              )}
            >
              <RadioGroupItem value="free" id={`${idPrefix}-ship-mode-free`} className="mt-0.5" />
              <div className="min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium leading-snug text-foreground">
                    Free shipping
                  </span>
                  <Badge variant="secondary" className="h-auto px-2 py-0.5 text-[10px] uppercase">
                    Admin
                  </Badge>
                </div>
                {effectiveValue === "free" ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Buyer pays $0 for shipping at checkout. You arrange fulfillment with any carrier
                    — not through Reswell UPS labels.
                  </p>
                ) : null}
              </div>
            </label>

            <label
              htmlFor={`${idPrefix}-ship-mode-flat`}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                effectiveValue === "flat"
                  ? "border-primary bg-primary/5"
                  : "border-slate-300 hover:border-primary/35",
              )}
            >
              <RadioGroupItem value="flat" id={`${idPrefix}-ship-mode-flat`} className="mt-0.5" />
              <div className="min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium leading-snug text-foreground">
                    Flat-rate shipping
                  </span>
                  <Badge variant="secondary" className="h-auto px-2 py-0.5 text-[10px] uppercase">
                    Admin
                  </Badge>
                </div>
                {effectiveValue === "flat" ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    One dollar amount buyers in the Continental U.S. pay at checkout. You arrange
                    fulfillment with any carrier — not through Reswell UPS labels.
                  </p>
                ) : null}
              </div>
            </label>
          </>
        ) : null}
      </RadioGroup>

      {allowPrivilegedModes && effectiveValue === "flat" ? flatRateSlot : null}
    </div>
  )
}
