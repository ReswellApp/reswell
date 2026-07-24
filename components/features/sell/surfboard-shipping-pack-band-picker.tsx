"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  getSurfboardShippingPackBand,
  resolveSurfboardShippingPackBandFromBoardSpecs,
  SURFBOARD_SHIPPING_PACK_BAND_IDS,
  surfboardShippingPackBandBoardSpecsError,
  surfboardShippingPackBandSummaryLine,
  surfboardShippingPackBandSurchargeHints,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export interface SurfboardShippingPackBandPickerProps {
  className?: string
  value: SurfboardShippingPackBandId | ""
  onChange: (bandId: SurfboardShippingPackBandId) => void
  boardLength?: string
  boardWidthInches?: string
  ceilingConfirmed?: boolean
  onCeilingConfirmedChange?: (confirmed: boolean) => void
}

export function SurfboardShippingPackBandPicker({
  className,
  value,
  onChange,
  boardLength = "",
  boardWidthInches = "",
  ceilingConfirmed = false,
  onCeilingConfirmedChange,
}: SurfboardShippingPackBandPickerProps) {
  const recommended = useMemo(
    () =>
      resolveSurfboardShippingPackBandFromBoardSpecs({
        boardLength,
        boardWidthInches,
      }),
    [boardLength, boardWidthInches],
  )

  const selectedError =
    value && boardLength.trim()
      ? surfboardShippingPackBandBoardSpecsError({
          bandId: value,
          boardLength,
          boardWidthInches,
        })
      : null

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="text-sm font-semibold text-foreground">Shortboard pack size</p>
        <p className="mt-1 text-sm text-muted-foreground/45 leading-relaxed">
          Smaller packs often cost buyers much less — UPS large-package fees kick in around 130″ DIM.
          Pick the smallest size your packed board will fit.
        </p>
        {recommended ? (
          <p className="mt-2 text-sm text-foreground/80">
            Based on your board, start with{" "}
            <span className="font-medium text-foreground">
              {getSurfboardShippingPackBand(recommended).label}
            </span>
            .
          </p>
        ) : null}
      </div>

      <RadioGroup
        value={value}
        onValueChange={(next) => {
          onChange(next as SurfboardShippingPackBandId)
          onCeilingConfirmedChange?.(false)
        }}
        className="space-y-3"
      >
        {SURFBOARD_SHIPPING_PACK_BAND_IDS.map((bandId) => {
          const band = getSurfboardShippingPackBand(bandId)
          const selected = value === bandId
          const tooBig = Boolean(
            boardLength.trim() &&
              surfboardShippingPackBandBoardSpecsError({
                bandId,
                boardLength,
                boardWidthInches,
              }),
          )
          const hints = surfboardShippingPackBandSurchargeHints(bandId)
          return (
            <label
              key={bandId}
              htmlFor={`sell-ship-pack-band-${bandId}`}
              className={cn(
                "block rounded-xl border transition-colors",
                tooBig
                  ? "cursor-not-allowed border-border/60 opacity-55"
                  : "cursor-pointer",
                selected && !tooBig
                  ? "border-primary bg-primary/5"
                  : !tooBig
                    ? "border-border hover:border-primary/35"
                    : null,
              )}
            >
              <div className="flex gap-3 p-4 sm:p-5">
                <RadioGroupItem
                  value={bandId}
                  id={`sell-ship-pack-band-${bandId}`}
                  disabled={tooBig}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{band.label}</p>
                    {recommended === bandId ? (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Recommended
                      </span>
                    ) : null}
                    {!hints.largePackageLikely ? (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Lower UPS fees
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                        Large package likely
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90">{band.summary}</p>
                  <p className="text-sm tabular-nums text-muted-foreground/70">
                    {surfboardShippingPackBandSummaryLine(bandId)}
                  </p>
                </div>
              </div>
            </label>
          )
        })}
      </RadioGroup>

      {selectedError ? (
        <p className="text-sm text-destructive leading-relaxed">{selectedError}</p>
      ) : null}

      {value && !selectedError && onCeilingConfirmedChange ? (
        <label
          htmlFor="sell-ship-pack-band-ceiling-confirm"
          className="flex gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3.5 cursor-pointer"
        >
          <Checkbox
            id="sell-ship-pack-band-ceiling-confirm"
            checked={ceilingConfirmed}
            onCheckedChange={(checked) => onCeilingConfirmedChange(checked === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed text-foreground/90">
            Looks right — my packed board will stay within this pack size. If it doesn&apos;t, I&apos;ll
            pick a larger one.
          </span>
        </label>
      ) : null}

      {!value ? (
        <p className="text-sm text-muted-foreground/45">
          Choose a shortboard pack size to continue.
        </p>
      ) : null}
    </div>
  )
}
