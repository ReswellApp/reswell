"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import { parseOptionalUsdAmount } from "@/lib/listing-compare-at-price"
import { AUTO_PRICE_DROP_DELAY_DAYS } from "@/lib/listing-auto-price-drop"

function priceDropFloorComplete(floorRaw: string, priceRaw: string): boolean {
  const floor = Number.parseFloat(floorRaw.trim().replace(/,/g, ""))
  if (!Number.isFinite(floor) || floor < 0.01 || floor > 999_999.99) return false
  const price = Number.parseFloat(priceRaw.trim().replace(/,/g, ""))
  return Number.isFinite(price) ? floor < price : true
}

function formatScheduledDropDate(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function SellAutoPriceDropFields({
  enabled,
  onEnabledChange,
  floor,
  onFloorChange,
  listingPrice,
  scheduledFor,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  floor: string
  onFloorChange: (floor: string) => void
  listingPrice: string
  scheduledFor?: string | null
}) {
  const listPriceUsd = parseOptionalUsdAmount(listingPrice)
  const floorUsd = parseOptionalUsdAmount(floor)
  const showMarkdownPreview =
    enabled && listPriceUsd != null && floorUsd != null && floorUsd < listPriceUsd
  const scheduledLabel =
    enabled && scheduledFor ? formatScheduledDropDate(scheduledFor) : null

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Switch
          id="sell-auto-price-drop"
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(v === true)}
          className="mt-0.5 shrink-0 data-[state=checked]:bg-listingHeart"
          aria-label="Drop the price in 2 weeks if not sold"
        />
        <div className="min-w-0 space-y-1">
          <Label
            htmlFor="sell-auto-price-drop"
            className="cursor-pointer text-sm font-medium leading-snug text-foreground"
          >
            Drop the price in 2 weeks
          </Label>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If it hasn&apos;t sold, we lower your list price after {AUTO_PRICE_DROP_DELAY_DAYS}{" "}
            days. You choose the floor — we won&apos;t go below that price. Buyers will see
            the original price crossed out.
          </p>
          {scheduledLabel ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Scheduled for {scheduledLabel}.
            </p>
          ) : null}
        </div>
      </div>
      {enabled ? (
        <div className="space-y-2 sm:pl-14">
          <Label htmlFor="sell-auto-price-drop-floor">
            Lowest price after 2 weeks ($){" "}
            <SellRequiredMark complete={priceDropFloorComplete(floor, listingPrice)} />
          </Label>
          <Input
            id="sell-auto-price-drop-floor"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={floor}
            onChange={(e) => onFloorChange(e.target.value)}
            className="h-11 border-foreground/20 bg-card shadow-sm placeholder:text-muted-foreground"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Must be less than your list price. After two weeks we&apos;ll drop to this amount
            and show the previous price as markdown.
          </p>
          {showMarkdownPreview && listPriceUsd != null && floorUsd != null ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Buyers will see after 2 weeks</p>
              <ListingPriceWithMarkdown
                priceUsd={floorUsd}
                compareAtPriceUsd={listPriceUsd}
                className="mt-1"
                priceClassName="text-base font-bold tabular-nums text-foreground"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
