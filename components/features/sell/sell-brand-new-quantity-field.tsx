"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BRAND_NEW_LISTING_QUANTITY_MAX,
  BRAND_NEW_LISTING_QUANTITY_MIN,
  isBrandNewListingCondition,
} from "@/lib/listing-stock-quantity"

export function SellBrandNewQuantityField({
  id,
  condition,
  value,
  onChange,
}: {
  id: string
  condition: string
  value: string
  onChange: (value: string) => void
}) {
  if (!isBrandNewListingCondition(condition)) return null

  return (
    <div className="space-y-1.5 sm:max-w-xs">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/85">
        Quantity
        <span className="text-destructive" aria-hidden>
          {" "}
          *
        </span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={BRAND_NEW_LISTING_QUANTITY_MIN}
        max={BRAND_NEW_LISTING_QUANTITY_MAX}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border-foreground/20 bg-card text-sm shadow-sm"
        required
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        How many identical brand-new units are in this listing. Buyers can purchase up to this many.
      </p>
    </div>
  )
}
