"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SELL_CONTROL_CLASS } from "@/components/features/sell/sell-form-surface"
import { isBrandNewListingCondition } from "@/lib/listing-quantity"

interface SellBrandNewQuantityFieldProps {
  id: string
  condition: string
  quantity: string
  onQuantityChange: (value: string) => void
}

export function SellBrandNewQuantityField({
  id,
  condition,
  quantity,
  onQuantityChange,
}: SellBrandNewQuantityFieldProps) {
  if (!isBrandNewListingCondition(condition)) return null

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/85">
        Quantity
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={quantity}
        placeholder="1"
        aria-label="Quantity"
        className={SELL_CONTROL_CLASS}
        onChange={(event) => onQuantityChange(event.target.value.replace(/[^\d]/g, ""))}
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        How many identical brand-new items this listing covers. Each sale stays on this listing and
        reduces the quantity. Used items stay one listing per item so the photos match that piece.
      </p>
    </div>
  )
}
