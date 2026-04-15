"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export interface SellPriceFieldsProps {
  listingPrice: string
  onListingPriceChange: (value: string) => void
  sellerPurchasePrice: string
  onSellerPurchasePriceChange: (value: string) => void
}

export function SellPriceFields({
  listingPrice,
  onListingPriceChange,
  sellerPurchasePrice,
  onSellerPurchasePriceChange,
}: SellPriceFieldsProps) {
  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground/45">
        Fair, competitive listings tend to sell faster on Reswell.
      </p>

      <div className="space-y-2">
        <Label htmlFor="sell-listing-price" className="text-sm font-semibold text-foreground">
          Listing price{" "}
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        </Label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground/45"
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
            className="pl-8 tabular-nums placeholder:text-muted-foreground/45"
            required
          />
        </div>
      </div>

      <Separator />

      <div className="rounded-lg border border-border bg-muted/30">
        <Accordion type="single" collapsible className="w-full px-1">
          <AccordionItem value="purchase" className="border-0">
            <AccordionTrigger className="px-3 py-3 text-left text-sm font-semibold hover:no-underline [&[data-state=open]]:pb-1">
              What you paid for the board
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3 pt-0">
              <p className="text-sm leading-relaxed text-muted-foreground/45">
                Keep track of what you paid for the board versus what it sells for. This info is for
                your benefit only.
              </p>
              <div className="mt-4 space-y-2">
                <Label htmlFor="sell-seller-purchase-price" className="text-sm font-semibold">
                  What you paid
                </Label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums text-muted-foreground/45"
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
                    className="pl-8 tabular-nums placeholder:text-muted-foreground/45"
                  />
                </div>
                <p className="text-xs text-muted-foreground/45">Not shown publicly.</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}
