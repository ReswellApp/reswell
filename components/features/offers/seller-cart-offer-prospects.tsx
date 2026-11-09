"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ShoppingCart } from "lucide-react"
import { SellerOfferToCartHolders } from "@/components/features/listings/seller-offer-to-cart-holders"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { portraitShimmer } from "@/lib/image-shimmer"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import type { ListingCartOfferProspect } from "@/lib/types/listing-cart-holders"
import { cn } from "@/lib/utils"
import {
  listingPortraitThumbClass,
  listingPortraitThumbSizes,
} from "@/lib/utils/dashboard-display-styles"

interface SellerCartOfferProspectsProps {
  sellerUserId: string
  prospects: ListingCartOfferProspect[]
  /** Open when the seller has no offers yet. Closed once real offers are on the page. */
  defaultOpen?: boolean
}

function cartCountLabel(count: number): string {
  return count === 1 ? "In 1 buyer’s cart" : `In ${count} buyers’ carts`
}

export function SellerCartOfferProspects({
  sellerUserId,
  prospects,
  defaultOpen = false,
}: SellerCartOfferProspectsProps) {
  const [open, setOpen] = useState(defaultOpen)
  if (prospects.length === 0) return null

  const listingLabel =
    prospects.length === 1 ? "1 listing in a cart" : `${prospects.length} listings in carts`

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Buyers with listings in cart
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {listingLabel}. Send a private offer when you want to.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-2 border-t border-border/60 px-3 py-3 sm:px-4">
          {prospects.map((listing) => (
            <li
              key={listing.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5"
            >
              <div className={listingPortraitThumbClass}>
                {listing.imageUrl ? (
                  <Image
                    src={listing.imageUrl}
                    alt=""
                    fill
                    sizes={listingPortraitThumbSizes}
                    unoptimized={listingImageShouldBypassOptimization(listing.imageUrl)}
                    placeholder="blur"
                    blurDataURL={portraitShimmer}
                    className={listingPhotoFillClassName}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {capitalizeWords(listing.title)}
                </p>
                <p className="text-xs text-muted-foreground">{cartCountLabel(listing.cartCount)}</p>
              </div>
              <SellerOfferToCartHolders
                listingId={listing.id}
                sellerUserId={sellerUserId}
                cartHolderCount={listing.cartCount}
                listingTitle={listing.title}
                listPrice={listing.price}
                primaryImageUrl={listing.imageUrl}
                triggerSize="sm"
                triggerLabel="Offer"
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}
