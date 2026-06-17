import { Hourglass } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  listingStockAvailabilityLabel,
  listingStockBadgeVariant,
  listingTracksInventory,
  listingStockQuantity,
  type ListingInventoryFields,
} from "@/lib/listing-inventory"

/** Inline stock message under price on peer listing PDPs (Shopify multi-qty). */
export function ListingStockAvailabilityMessage({
  listing,
  className,
}: {
  listing: ListingInventoryFields
  className?: string
}) {
  const label = listingStockAvailabilityLabel(listing)
  if (!label) return null

  const variant = listingStockBadgeVariant(listing)
  const isLow = variant === "low_stock"
  const isOut = variant === "out_of_stock"
  const showUrgency =
    !listingTracksInventory(listing) ||
    (listingTracksInventory(listing) && listingStockQuantity(listing) <= 10)

  return (
    <p
      className={cn(
        "flex items-start gap-2 text-[14px] sm:text-[15px]",
        isOut ? "text-destructive" : isLow ? "text-amber-900 dark:text-amber-100" : "text-foreground",
        className,
      )}
    >
      <Hourglass className="mt-0.5 h-[14px] w-[14px] shrink-0 text-muted-foreground sm:h-[15px] sm:w-[15px]" aria-hidden />
      <span>
        <span className="font-semibold">{label}</span>
        {showUrgency && !isOut ? (
          <span className="font-normal text-muted-foreground"> — grab it before it&apos;s gone</span>
        ) : null}
      </span>
    </p>
  )
}

/** Pill badge for listing detail (mirrors legacy shop-new PDP styling). */
export function ListingStockBadge({
  listing,
  className,
}: {
  listing: ListingInventoryFields
  className?: string
}) {
  const variant = listingStockBadgeVariant(listing)
  if (variant === "hidden") return null

  const qty = Math.max(0, Number(listing.stock_quantity) || 0)

  if (variant === "out_of_stock") {
    return (
      <span
        className={cn(
          "inline-flex rounded-full bg-destructive/12 px-3.5 py-1 text-[15px] font-medium text-destructive",
          className,
        )}
      >
        Out of stock
      </span>
    )
  }

  if (variant === "low_stock") {
    return (
      <span
        className={cn(
          "inline-flex rounded-full bg-amber-500/12 px-3.5 py-1 text-[15px] font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-100",
          className,
        )}
      >
        {qty === 1 ? "Only 1 left" : `Only ${qty} left`}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-muted/70 px-3.5 py-1 text-[15px] font-medium text-muted-foreground dark:bg-muted/50",
        className,
      )}
    >
      In stock
    </span>
  )
}
