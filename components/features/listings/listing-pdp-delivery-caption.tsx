import { MapPin } from "lucide-react"
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
}: {
  isSold?: boolean
  shippingOffered: boolean
  pickupOffered: boolean
  shippingPriceCaption?: string | null
  locationLine?: string | null
  className?: string
}) {
  if (isSold) return null

  const shippingLine = listingShippingCaptionForPdp(shippingOffered, shippingPriceCaption)
  const pickupLine = listingPickupCaption(pickupOffered, locationLine)
  if (!shippingLine && !pickupLine) return null

  return (
    <div className={cn("mt-1.5 space-y-1 text-[15px] font-medium leading-normal", className)}>
      {shippingLine ? (
        <p className={LISTING_SHIPPING_EMPHASIS_CLASS}>{shippingLine}</p>
      ) : null}
      {pickupLine ? (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-[1em] w-[1em] shrink-0" aria-hidden />
          <span>{pickupLine}</span>
        </p>
      ) : null}
    </div>
  )
}
