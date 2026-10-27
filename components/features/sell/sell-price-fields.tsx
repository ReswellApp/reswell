"use client"

import type { ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { SELL_CONTROL_CLASS } from "@/components/features/sell/sell-form-surface"
import { SellEarningsBreakdown } from "@/components/features/sell/sell-earnings-breakdown"
import {
  SellPriceGuidancePicker,
  type SellPriceGuidancePickerProps,
} from "@/components/features/sell/sell-price-guidance-picker"
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import { ListingPriceMarkdownToggle } from "@/components/features/listings/listing-price-markdown-toggle"
import { cn } from "@/lib/utils"
import {
  parseOptionalUsdAmount,
  resolveCompareAtPriceOnUpdate,
} from "@/lib/listing-compare-at-price"
import { sellListingPriceIsPublishable } from "@/lib/utils/sell-listing-price"
import { useAdoptAutofilledSellPrice } from "@/components/features/sell/use-adopt-autofilled-sell-price"

/** Mirrors the listing-price rule in `pricePublishFieldsComplete` (sell-section-completion). */
function listingPriceComplete(raw: string): boolean {
  return sellListingPriceIsPublishable(raw)
}

export interface SellPriceFieldsProps {
  listingPrice: string
  onListingPriceChange: (value: string) => void
  sellerPurchasePrice: string
  onSellerPurchasePriceChange: (value: string) => void
  sellerPurchasedFrom: string
  onSellerPurchasedFromChange: (value: string) => void
  sellerPurchasedOn: string
  onSellerPurchasedOnChange: (value: string) => void
  /** Renders after the purchase-price accordion (e.g. sell-faster toggles). */
  afterListingPrice?: ReactNode
  purchaseAccordionTitle?: string
  purchaseAccordionDescription?: string
  showPurchasePrice?: boolean
  publishedPriceUsd?: number | null
  existingCompareAtPriceUsd?: number | null
  showPriceMarkdown?: boolean
  onShowPriceMarkdownChange?: (value: boolean) => void
  /**
   * Optional Reswell price guidance (surfboards + fins). When brand + model are set,
   * shows clickable low / best / high suggestions from the price guide + market comps.
   */
  priceGuidance?: Omit<
    SellPriceGuidancePickerProps,
    "listingPrice" | "onSelectPrice" | "className"
  > | null
}

export function SellPriceFields({
  listingPrice,
  onListingPriceChange,
  sellerPurchasePrice,
  onSellerPurchasePriceChange,
  sellerPurchasedFrom,
  onSellerPurchasedFromChange,
  sellerPurchasedOn,
  onSellerPurchasedOnChange,
  afterListingPrice,
  purchaseAccordionTitle = "What you paid for the board",
  purchaseAccordionDescription = "Keep track of what you paid for the board versus what it sells for. This info is for your benefit only.",
  showPurchasePrice = true,
  publishedPriceUsd = null,
  existingCompareAtPriceUsd = null,
  showPriceMarkdown = false,
  onShowPriceMarkdownChange,
  priceGuidance = null,
}: SellPriceFieldsProps) {
  useAdoptAutofilledSellPrice("sell-listing-price", listingPrice, onListingPriceChange)
  const nextPrice = parseOptionalUsdAmount(listingPrice)
  const canOfferMarkdown =
    publishedPriceUsd != null &&
    nextPrice != null &&
    onShowPriceMarkdownChange != null &&
    (nextPrice < publishedPriceUsd ||
      (existingCompareAtPriceUsd != null && existingCompareAtPriceUsd > nextPrice))
  const previewCompareAt =
    canOfferMarkdown && nextPrice != null && showPriceMarkdown
      ? resolveCompareAtPriceOnUpdate({
          currentPriceUsd: publishedPriceUsd ?? nextPrice,
          nextPriceUsd: nextPrice,
          existingCompareAtUsd: existingCompareAtPriceUsd,
          showPriceMarkdown: true,
        })
      : null

  return (
    <div className="w-full space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Fair, competitive listings tend to sell faster on Reswell.
      </p>

      {priceGuidance ? (
        <SellPriceGuidancePicker
          categorySlug={priceGuidance.categorySlug}
          brandId={priceGuidance.brandId}
          brandModelId={priceGuidance.brandModelId}
          condition={priceGuidance.condition}
          listingPrice={listingPrice}
          onSelectPrice={onListingPriceChange}
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="sell-listing-price" className="text-sm font-semibold text-foreground">
          Listing price{" "}
          <SellRequiredMark complete={listingPriceComplete(listingPrice)} />
        </Label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
            aria-hidden
          >
            $
          </span>
          <Input
            id="sell-listing-price"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={listingPrice}
            onChange={(e) => onListingPriceChange(e.target.value)}
            className={cn(SELL_CONTROL_CLASS, "pl-8 tabular-nums")}
            aria-required="true"
          />
        </div>
        {canOfferMarkdown ? (
          <ListingPriceMarkdownToggle
            id="sell-show-price-markdown"
            checked={showPriceMarkdown}
            onCheckedChange={onShowPriceMarkdownChange}
            previewPriceUsd={nextPrice}
            previewCompareAtUsd={previewCompareAt}
            className="pt-1"
          />
        ) : null}
      </div>

      <SellEarningsBreakdown listingPrice={listingPrice} />

      {showPurchasePrice ? (
        <div className="rounded-lg border border-slate-300 bg-slate-50/80">
          <Accordion type="single" collapsible className="w-full px-1">
            <AccordionItem value="purchase" className="border-0">
              <AccordionTrigger className="px-3 py-3 text-left text-sm font-semibold hover:no-underline [&[data-state=open]]:pb-1">
                {purchaseAccordionTitle}
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-0">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {purchaseAccordionDescription}
                </p>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="sell-seller-purchase-price" className="text-sm font-semibold">
                    What you paid
                  </Label>
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground"
                      aria-hidden
                    >
                      $
                    </span>
                    <Input
                      id="sell-seller-purchase-price"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={sellerPurchasePrice}
                      onChange={(e) => onSellerPurchasePriceChange(e.target.value)}
                      className={cn(SELL_CONTROL_CLASS, "pl-8 tabular-nums")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Not shown publicly.</p>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sell-seller-purchased-from" className="text-sm font-semibold">
                      Bought from
                    </Label>
                    <Input
                      id="sell-seller-purchased-from"
                      type="text"
                      autoComplete="off"
                      maxLength={200}
                      placeholder="Shop, seller, marketplace"
                      value={sellerPurchasedFrom}
                      onChange={(event) => onSellerPurchasedFromChange(event.target.value)}
                      className={SELL_CONTROL_CLASS}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sell-seller-purchased-on" className="text-sm font-semibold">
                      Date purchased
                    </Label>
                    <Input
                      id="sell-seller-purchased-on"
                      type="date"
                      value={sellerPurchasedOn}
                      onChange={(event) => onSellerPurchasedOnChange(event.target.value)}
                      className={SELL_CONTROL_CLASS}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : null}

      {afterListingPrice}
    </div>
  )
}
