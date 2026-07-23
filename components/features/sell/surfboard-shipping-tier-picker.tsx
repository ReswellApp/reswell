"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { formatBoardLengthForTitle } from "@/lib/board-measurements"
import {
  getSurfboardShippingTier,
  resolveSurfboardShippingTierFromBoardSpecs,
  surfboardShippingTierAllowsBoardLength,
  surfboardShippingTierBoardLengthError,
  surfboardShippingTierEasyFitLine,
  surfboardShippingTierEasyWhy,
  surfboardShippingTierNextLarger,
  SURFBOARD_SHIPPING_TIER_IDS,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export interface SurfboardShippingTierPickerProps {
  className?: string
  value: SurfboardShippingTierId | ""
  onChange: (tierId: SurfboardShippingTierId) => void
  /** Bare board length from Dimensions — drives the recommendation. */
  boardLength?: string
  /** Bare board width — wide boards bump Shortboard → Midlength. */
  boardWidthInches?: string
  category?: string
  /** Seller must confirm the packed board fits the selected ceiling. */
  ceilingConfirmed?: boolean
  onCeilingConfirmedChange?: (confirmed: boolean) => void
}

function largerTiersFrom(
  recommended: SurfboardShippingTierId,
): SurfboardShippingTierId[] {
  const out: SurfboardShippingTierId[] = []
  let cursor: SurfboardShippingTierId | null = recommended
  while (cursor) {
    const next = surfboardShippingTierNextLarger(cursor)
    if (!next) break
    out.push(next)
    cursor = next
  }
  return out
}

export function SurfboardShippingTierPicker({
  className,
  value,
  onChange,
  boardLength = "",
  boardWidthInches = "",
  category = "",
  ceilingConfirmed = false,
  onCeilingConfirmedChange,
}: SurfboardShippingTierPickerProps) {
  const [showBiggerOptions, setShowBiggerOptions] = useState(false)

  const suggestion = useMemo(
    () =>
      resolveSurfboardShippingTierFromBoardSpecs({
        boardLength,
        boardWidthInches,
        category,
      }),
    [boardLength, boardWidthInches, category],
  )

  const recommendedTierId = suggestion?.tierId ?? null
  const selectedTierId = value || null
  const boardLengthLabel = boardLength.trim()
    ? formatBoardLengthForTitle(boardLength)
    : ""

  const selectedLengthError =
    selectedTierId && boardLength.trim()
      ? surfboardShippingTierBoardLengthError(boardLength, selectedTierId)
      : null

  const biggerOptions = recommendedTierId
    ? largerTiersFrom(recommendedTierId).filter(
        (tierId) =>
          !boardLength.trim() || surfboardShippingTierAllowsBoardLength(boardLength, tierId),
      )
    : SURFBOARD_SHIPPING_TIER_IDS.filter(
        (tierId) =>
          !boardLength.trim() || surfboardShippingTierAllowsBoardLength(boardLength, tierId),
      )

  const usingRecommended =
    Boolean(recommendedTierId) && selectedTierId === recommendedTierId

  const selectTier = (tierId: SurfboardShippingTierId) => {
    if (tierId === value) return
    onChange(tierId)
    onCeilingConfirmedChange?.(false)
    if (recommendedTierId && tierId !== recommendedTierId) {
      setShowBiggerOptions(true)
    }
  }

  if (!boardLength.trim() && !recommendedTierId) {
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-sm text-muted-foreground/45 leading-relaxed">
          Enter your board length in Dimensions above — we&apos;ll pick the right shipping size for
          you.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {boardLengthLabel
            ? `Shipping size for your ${boardLengthLabel} board`
            : "Shipping size for your board"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground/45 leading-relaxed">
          Buyers pay shipping at checkout. We quote the maximum box for this size — your packed
          board must stay at or under it. Smaller is fine.
        </p>
        {suggestion?.reason === "wide-board" ? (
          <p className="mt-2 text-sm text-foreground/80 leading-relaxed">
            Your board is wide, so we recommend a larger shipping size than length alone would
            suggest.
          </p>
        ) : null}
      </div>

      {recommendedTierId ? (
        <button
          type="button"
          onClick={() => selectTier(recommendedTierId)}
          className={cn(
            "w-full rounded-xl border p-4 sm:p-5 text-left transition-colors",
            usingRecommended
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/35",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {getSurfboardShippingTier(recommendedTierId).label}
            </p>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Recommended
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/90">
            {surfboardShippingTierEasyWhy(recommendedTierId)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground/45 leading-relaxed">
            {surfboardShippingTierEasyFitLine(recommendedTierId)}
          </p>
        </button>
      ) : null}

      {selectedTierId && !usingRecommended && !selectedLengthError ? (
        <div className="rounded-xl border border-primary bg-primary/5 p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground">
            {getSurfboardShippingTier(selectedTierId).label}
          </p>
          <p className="mt-1 text-sm text-foreground/90">
            {surfboardShippingTierEasyWhy(selectedTierId)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground/45 leading-relaxed">
            {surfboardShippingTierEasyFitLine(selectedTierId)}
          </p>
        </div>
      ) : null}

      {biggerOptions.length > 0 ? (
        <div className="space-y-3">
          <button
            type="button"
            className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-primary"
            onClick={() => setShowBiggerOptions((open) => !open)}
          >
            {showBiggerOptions ? "Hide larger sizes" : "Need a bigger box when packing?"}
          </button>

          {showBiggerOptions ? (
            <RadioGroup
              value={selectedTierId && !usingRecommended ? selectedTierId : ""}
              onValueChange={(next) => selectTier(next as SurfboardShippingTierId)}
              className="space-y-2"
            >
              {biggerOptions.map((tierId) => {
                const tier = getSurfboardShippingTier(tierId)
                const selected = selectedTierId === tierId
                return (
                  <label
                    key={tierId}
                    htmlFor={`sell-ship-tier-alt-${tierId}`}
                    className={cn(
                      "flex gap-3 rounded-xl border p-4 cursor-pointer transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/35",
                    )}
                  >
                    <RadioGroupItem
                      value={tierId}
                      id={`sell-ship-tier-alt-${tierId}`}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{tier.label}</p>
                      <p className="mt-0.5 text-sm text-foreground/90">
                        {surfboardShippingTierEasyWhy(tierId)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground/45 leading-relaxed">
                        {surfboardShippingTierEasyFitLine(tierId)}
                      </p>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          ) : null}
        </div>
      ) : null}

      {selectedTierId && !selectedLengthError && onCeilingConfirmedChange ? (
        <label
          htmlFor="sell-ship-tier-ceiling-confirm"
          className="flex gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3.5 cursor-pointer"
        >
          <Checkbox
            id="sell-ship-tier-ceiling-confirm"
            checked={ceilingConfirmed}
            onCheckedChange={(checked) => onCeilingConfirmedChange(checked === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed text-foreground/90">
            Looks right — my packed board will stay within this maximum size. If it doesn&apos;t,
            I&apos;ll pick a larger size.
          </span>
        </label>
      ) : null}

      {selectedLengthError ? (
        <p className="text-sm text-destructive leading-relaxed">{selectedLengthError}</p>
      ) : null}

      {!selectedTierId ? (
        <p className="text-sm text-muted-foreground/45">
          Tap the recommended size to continue.
        </p>
      ) : null}
    </div>
  )
}
