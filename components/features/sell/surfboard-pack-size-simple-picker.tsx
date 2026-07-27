"use client"

import { cn } from "@/lib/utils"
import {
  getSurfboardShippingPackBand,
  SURFBOARD_SHIPPING_PACK_BAND_IDS,
  surfboardShippingPackBandBoardSpecsError,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export type SurfboardPackSizeSimplePickerProps = {
  className?: string
  value: SurfboardShippingPackBandId | ""
  onChange: (bandId: SurfboardShippingPackBandId) => void
  boardLength?: string
  boardWidthInches?: string
  /** Smallest band that fits — shown as Recommended. */
  recommendedBandId?: SurfboardShippingPackBandId | ""
}

export function SurfboardPackSizeSimplePicker({
  className,
  value,
  onChange,
  boardLength = "",
  boardWidthInches = "",
  recommendedBandId = "",
}: SurfboardPackSizeSimplePickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground">Pack size</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Pick the smallest box your packed board will fit — smaller usually means lower shipping for
        buyers.
      </p>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as SurfboardShippingPackBandId)}
        className="grid gap-2 sm:grid-cols-3"
      >
        {SURFBOARD_SHIPPING_PACK_BAND_IDS.map((bandId) => {
          const band = getSurfboardShippingPackBand(bandId)
          const tooBig = Boolean(
            boardLength.trim() &&
              surfboardShippingPackBandBoardSpecsError({
                bandId,
                boardLength,
                boardWidthInches,
              }),
          )
          const selected = value === bandId
          return (
            <label
              key={bandId}
              htmlFor={`sell-pack-size-${bandId}`}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                tooBig && "cursor-not-allowed opacity-45",
                selected && !tooBig
                  ? "border-primary bg-primary/5"
                  : !tooBig
                    ? "border-border hover:border-primary/35"
                    : "border-border/60",
              )}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value={bandId}
                  id={`sell-pack-size-${bandId}`}
                  disabled={tooBig}
                  className="shrink-0"
                />
                <span className="text-sm font-semibold text-foreground">{band.label}</span>
                {recommendedBandId === bandId && !tooBig ? (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Best fit
                  </span>
                ) : null}
              </div>
              <p className="pl-6 text-xs text-muted-foreground/70 leading-relaxed">
                {bandId === "shortboard_compact"
                  ? "Lowest rates when it fits"
                  : bandId === "shortboard_standard"
                    ? "A bit more room"
                    : "Largest shortboard box"}
              </p>
            </label>
          )
        })}
      </RadioGroup>
    </div>
  )
}
