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
import { ReswellShippingGuideTrigger } from "@/components/features/sell/reswell-shipping-guide-trigger"
import type { ReswellShippingGuideTopicId } from "@/lib/reswell-shipping-guide"

export interface SurfboardShippingPackBandPickerProps {
  className?: string
  value: SurfboardShippingPackBandId | ""
  onChange: (bandId: SurfboardShippingPackBandId) => void
  boardLength?: string
  boardWidthInches?: string
  ceilingConfirmed?: boolean
  onCeilingConfirmedChange?: (confirmed: boolean) => void
  /** Opens the Reswell shipping guide to a topic. */
  onOpenGuide?: (topicId: ReswellShippingGuideTopicId) => void
}

export function SurfboardShippingPackBandPicker({
  className,
  value,
  onChange,
  boardLength = "",
  boardWidthInches = "",
  ceilingConfirmed = false,
  onCeilingConfirmedChange,
  onOpenGuide,
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Shortboard pack size</p>
          {onOpenGuide ? (
            <ReswellShippingGuideTrigger
              topicId="shortboard"
              onOpen={onOpenGuide}
              variant="link"
              label="Compare pack sizes"
            />
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
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
          const fitWarning =
            boardLength.trim()
              ? surfboardShippingPackBandBoardSpecsError({
                  bandId,
                  boardLength,
                  boardWidthInches,
                })
              : null
          const hints = surfboardShippingPackBandSurchargeHints(bandId)
          return (
            <div
              key={bandId}
              className={cn(
                "relative block rounded-xl border transition-colors",
                selected
                  ? fitWarning
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-primary bg-primary/5"
                  : "border-border hover:border-primary/35",
              )}
            >
              {onOpenGuide ? (
                <ReswellShippingGuideTrigger
                  topicId={bandId}
                  onOpen={onOpenGuide}
                  label={`Learn more about ${band.label} pack size`}
                  className="absolute right-2 top-2 z-[1]"
                />
              ) : null}
              <label
                htmlFor={`sell-ship-pack-band-${bandId}`}
                className="block cursor-pointer"
              >
                <div className="flex gap-3 p-4 sm:p-5 pr-10">
                  <RadioGroupItem
                    value={bandId}
                    id={`sell-ship-pack-band-${bandId}`}
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
                      {fitWarning ? (
                        <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                          May not fit
                        </span>
                      ) : !hints.largePackageLikely ? (
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
            </div>
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
        <p className="text-sm text-muted-foreground">
          Choose a shortboard pack size to continue.
        </p>
      ) : null}
    </div>
  )
}
