"use client"

import { ShoppingCart } from "lucide-react"
import { SellerOfferToCartHolders } from "@/components/features/listings/seller-offer-to-cart-holders"
import { capitalizeWords } from "@/lib/listing-labels"
import type { ListingCartOfferProspect } from "@/lib/types/listing-cart-holders"

interface SellerCartOfferProspectsProps {
  sellerUserId: string
  prospects: ListingCartOfferProspect[]
}

export function SellerCartOfferProspects({
  sellerUserId,
  prospects,
}: SellerCartOfferProspectsProps) {
  if (prospects.length === 0) return null

  return (
    <div className="mt-6 rounded-2xl border border-listingHeart/20 bg-listingHeart/5 px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[15px] font-semibold text-foreground">Buyers with your listings in cart</p>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        Send a private offer to someone who already has the item saved for checkout.
      </p>
      <ul className="mt-4 space-y-2">
        {prospects.map((listing) => (
          <li
            key={listing.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
          >
            <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {capitalizeWords(listing.title)}
              </p>
              <p className="text-xs text-muted-foreground">
                {listing.cartCount === 1
                  ? "In 1 buyer’s cart"
                  : `In ${listing.cartCount} buyers’ carts`}
              </p>
            </div>
            <SellerOfferToCartHolders
              listingId={listing.id}
              sellerUserId={sellerUserId}
              cartHolderCount={listing.cartCount}
              listingTitle={listing.title}
              triggerSize="sm"
              triggerLabel="Offer"
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
