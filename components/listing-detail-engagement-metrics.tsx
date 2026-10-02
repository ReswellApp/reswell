import { ShoppingCart } from "lucide-react"

import { SellerOfferToCartHolders } from "@/components/features/listings/seller-offer-to-cart-holders"
import { LISTING_SHIPPING_EMPHASIS_CLASS } from "@/lib/listing-fulfillment"
import { cn } from "@/lib/utils"

export type ListingOfferToCartProps = {
  listingId: string
  sellerUserId: string
  listingTitle?: string
  listPrice?: number
  primaryImageUrl?: string | null
}

interface ListingDetailEngagementMetricsProps {
  views: number
  watchers: number
  cartHolderCount: number
  isSold?: boolean
  className?: string
  /** Listing owner: cart count opens the seller-offer dialog. */
  offerToCart?: ListingOfferToCartProps | null
  /** Views are on the listing row; hide watcher and cart lines until those counts stream in. */
  omitSocialCounts?: boolean
}

export function ListingDetailEngagementMetrics({
  views,
  watchers,
  cartHolderCount,
  isSold = false,
  className,
  offerToCart = null,
  omitSocialCounts = false,
}: ListingDetailEngagementMetricsProps) {
  if (isSold) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-muted-foreground",
        className,
      )}
    >
      <span>
        Views:{" "}
        <span className="font-medium tabular-nums text-foreground/80">
          {Number.isFinite(views) ? views : 0}
        </span>
      </span>
      {omitSocialCounts ? null : (
        <span>
          Watchers:{" "}
          <span className="font-medium tabular-nums text-foreground/80">
            {Number.isFinite(watchers) ? watchers : 0}
          </span>
        </span>
      )}
      {!omitSocialCounts && cartHolderCount > 0 ? (
        offerToCart ? (
          <SellerOfferToCartHolders
            listingId={offerToCart.listingId}
            sellerUserId={offerToCart.sellerUserId}
            cartHolderCount={cartHolderCount}
            listingTitle={offerToCart.listingTitle}
            listPrice={offerToCart.listPrice}
            primaryImageUrl={offerToCart.primaryImageUrl}
            triggerVariant="stat"
          />
        ) : (
          <span className={cn("inline-flex items-center gap-1", LISTING_SHIPPING_EMPHASIS_CLASS)}>
            <ShoppingCart className="h-3 w-3 shrink-0" aria-hidden />
            <span>
              {cartHolderCount === 1
                ? "In someone’s cart"
                : `In ${cartHolderCount} buyers’ carts`}
            </span>
          </span>
        )
      ) : null}
    </div>
  )
}
