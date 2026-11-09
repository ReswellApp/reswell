import {
  LISTING_SHIPPING_EMPHASIS_CLASS,
  listingPickupCaption,
  listingShippingCaptionForPdp,
} from "@/lib/listing-fulfillment"
import { cn } from "@/lib/utils"

export function ListingPdpDeliveryCaption({
  isSold = false,
  shippingOffered,
  pickupOffered,
  shippingPriceCaption = null,
  locationLine = null,
  className,
  compact = false,
}: {
  isSold?: boolean
  shippingOffered: boolean
  pickupOffered: boolean
  shippingPriceCaption?: string | null
  locationLine?: string | null
  className?: string
  /** Tighter type under list price on mobile PDP. */
  compact?: boolean
}) {
  if (isSold) return null

  const shippingLine = listingShippingCaptionForPdp(shippingOffered, shippingPriceCaption)
  const pickupLine = listingPickupCaption(pickupOffered, locationLine)
  if (!shippingLine && !pickupLine) return null

  return (
    <div
      className={cn(
        "mt-1.5 space-y-1 font-medium leading-normal",
        compact ? "text-[13px] leading-snug" : "text-[15px]",
        className,
      )}
    >
      {shippingLine ? (
        <p className={LISTING_SHIPPING_EMPHASIS_CLASS}>{shippingLine}</p>
      ) : null}
      {pickupLine ? (
        <p className="font-normal text-muted-foreground">{pickupLine}</p>
      ) : null}
    </div>
  )
}
