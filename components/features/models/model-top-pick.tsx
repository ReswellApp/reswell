import Image from "next/image"
import Link from "next/link"
import { Truck } from "lucide-react"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { ListingConditionBadge } from "@/components/features/listings/listing-condition-badge"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { VerifiedBadge } from "@/components/verified-badge"
import { Button } from "@/components/ui/button"
import { listingHeroSlideSrc } from "@/lib/listing-image-display"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import { sellerProfileHref } from "@/lib/seller-slug"
import type { ModelMarketplaceListing } from "@/lib/db/brand-listings"

function excerpt(text: string | null, max = 280): string | null {
  if (!text) return null
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return null
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}…`
}

function locationLine(listing: ModelMarketplaceListing): string | null {
  const city = listing.city?.trim()
  const state = listing.state?.trim()
  if (city && state) return `${city}, ${state}`
  return listing.profiles?.location?.trim() || city || state || null
}

export function ModelTopPick({
  listing,
  isFavorited,
  isLoggedIn,
}: {
  listing: ModelMarketplaceListing
  isFavorited: boolean
  isLoggedIn: boolean
}) {
  const href = listingDetailHref(listing)
  const imageSrc = listingHeroSlideSrc(listing.listing_images)
  const sellerName = getPublicSellerDisplayName(listing.profiles)
  const sellerHref = sellerProfileHref(listing.profiles)
  const about = excerpt(listing.description)
  const location = locationLine(listing)
  const price = Number(listing.price)
  const isNew = listing.condition === "brand_new" || listing.condition === "new"

  return (
    <section className="rounded-2xl border border-border/80 bg-background p-4 sm:p-6">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        {isNew ? "Top pick for brand new" : "Top pick"}
      </h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr_16rem] lg:items-start">
        <Link href={href} className="relative block overflow-hidden rounded-xl bg-muted">
          <div className="relative aspect-square">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={listing.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 22rem"
                className="object-cover"
              />
            ) : null}
          </div>
          <FavoriteButtonCardOverlay
            listingId={listing.id}
            initialFavorited={isFavorited}
            isLoggedIn={isLoggedIn}
          />
        </Link>

        <div className="min-w-0">
          <Link href={href} className="text-lg font-semibold tracking-tight text-foreground hover:underline">
            {listing.title}
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ListingConditionBadge condition={listing.condition} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {sellerHref !== "/sellers" ? (
              <Link href={sellerHref} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                {sellerName}
                {listing.shop_verified ? <VerifiedBadge size="sm" /> : null}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                {sellerName}
                {listing.shop_verified ? <VerifiedBadge size="sm" /> : null}
              </span>
            )}
            {location ? <span>{location}</span> : null}
          </div>
          {about ? (
            <div className="mt-5">
              <p className="text-sm font-medium text-foreground">About this listing</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{about}</p>
            </div>
          ) : null}
          <Link href={href} className="mt-4 inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline">
            View full listing
          </Link>
        </div>

        <div className="min-w-0 lg:text-right">
          {Number.isFinite(price) ? (
            <ListingPriceWithMarkdown
              priceUsd={price}
              compareAtPriceUsd={listing.compare_at_price}
              priceClassName="text-2xl font-semibold tracking-tight"
            />
          ) : null}
          {listing.shipping_available ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground lg:justify-end">
              <Truck className="h-4 w-4" aria-hidden />
              Shipping available
            </p>
          ) : listing.local_pickup ? (
            <p className="mt-2 text-sm text-muted-foreground">Local pickup</p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2">
            <Button asChild className="rounded-full">
              <Link href={peerListingCheckoutHref(listing.section, listing.slug ?? listing.id)}>
                Buy now
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href={href}>View listing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
