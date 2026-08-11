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
import { SellRequiredMark } from "@/components/features/sell/sell-required-mark"
import { cn } from "@/lib/utils"

/** Mirrors the listing-price rule in `pricePublishFieldsComplete` (sell-section-completion). */
function listingPriceComplete(raw: string): boolean {
  const t = raw.trim().replace(/,/g, "")
  if (!t) return false
  const n = Number.parseFloat(t)
  return Number.isFinite(n) && n >= 0.01 && n <= 999_999.99
}

export interface SellPriceFieldsProps {
  listingPrice: string
  onListingPriceChange: (value: string) => void
  sellerPurchasePrice: string
  onSellerPurchasePriceChange: (value: string) => void
  /** Renders after the purchase-price accordion (e.g. sell-faster toggles). */
  afterListingPrice?: ReactNode
  purchaseAccordionTitle?: string
  purchaseAccordionDescription?: string
}

export function SellPriceFields({
  listingPrice,
  onListingPriceChange,
  sellerPurchasePrice,
  onSellerPurchasePriceChange,
  afterListingPrice,
  purchaseAccordionTitle = "What you paid for the board",
  purchaseAccordionDescription = "Keep track of what you paid for the board versus what it sells for. This info is for your benefit only.",
}: SellPriceFieldsProps) {
  return (
    <div className="w-full space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Fair, competitive listings tend to sell faster on Reswell.
      </p>

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
      </div>

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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {afterListingPrice}
    </div>
  )
}
