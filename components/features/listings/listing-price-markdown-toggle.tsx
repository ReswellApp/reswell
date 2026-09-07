"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { cn } from "@/lib/utils"

export function ListingPriceMarkdownToggle({
  id,
  checked,
  onCheckedChange,
  disabled,
  previewPriceUsd,
  previewCompareAtUsd,
  className,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  previewPriceUsd?: number | null
  previewCompareAtUsd?: number | null
  className?: string
}) {
  const showPreview =
    checked &&
    previewPriceUsd != null &&
    previewCompareAtUsd != null &&
    previewCompareAtUsd > previewPriceUsd

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="min-w-0 space-y-1">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-snug">
            Show price drop on listing
          </Label>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Buyers will see your previous price crossed out next to the new price.
          </p>
        </div>
      </div>
      {showPreview && previewPriceUsd != null && previewCompareAtUsd != null ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Buyers will see</p>
          <ListingPriceWithMarkdown
            priceUsd={previewPriceUsd}
            compareAtPriceUsd={previewCompareAtUsd}
            className="mt-1"
            priceClassName="text-base font-bold tabular-nums text-foreground"
          />
        </div>
      ) : null}
    </div>
  )
}
