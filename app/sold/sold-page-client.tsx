"use client"

import Link from "next/link"
import { formatDistanceToNowStrict } from "date-fns"
import { capitalizeWords, formatListingTileCategoryPillText } from "@/lib/listing-labels"
import { ListingTile } from "@/components/listing-tile"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { Package } from "lucide-react"
import { listingDetailHref } from "@/lib/listing-href"

export type SoldFeedListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  soldPrice: number
  condition: string
  section: string
  city?: string | null
  state?: string | null
  board_type?: string | null
  board_length?: string | null
  sold_at: string
  listing_images?: { url: string; is_primary?: boolean }[] | null
  profiles?: {
    display_name?: string | null
    avatar_url?: string | null
    location?: string | null
    sales_count?: number
    shop_verified?: boolean
  } | null
  categories?: { name?: string | null; slug?: string | null } | null
}

export interface RecentlySoldPageClientProps {
  soldListings: SoldFeedListing[]
  soldStats: { count: number; gmvFormatted: string }
}

function soldRelativeLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const soldDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round((sod.getTime() - soldDay.getTime()) / 86400000)
  if (dayDiff === 0) return "Sold today"
  if (dayDiff === 1) return "Sold yesterday"
  return `Sold ${formatDistanceToNowStrict(d, { addSuffix: true })}`
}

function SoldListingCard({ listing }: { listing: SoldFeedListing }) {
  const href = listingDetailHref(listing)
  const locationText =
    listing.city && listing.state
      ? `${listing.city}, ${listing.state}`
      : listing.profiles?.location || "Location not set"
  const timeLine = soldRelativeLabel(listing.sold_at)

  return (
    <ListingTile
      href={href}
      listingId={listing.id}
      title={capitalizeWords(listing.title)}
      imageAlt={capitalizeWords(listing.title)}
      listingImages={listing.listing_images ?? null}
      price={listing.price}
      linkLayout="unified"
      useBlurPlaceholder={false}
      imageGrayscale
      cardClassName={listingProductCardGridClassName}
      cardContentClassName="min-w-0 p-3"
      variant="soldFeed"
      soldPrice={listing.soldPrice}
      subtitle={
        listing.section === "surfboards" && listing.board_length ? (
          <p className="text-sm text-muted-foreground mt-1">{listing.board_length}</p>
        ) : null
      }
      soldFootnote={
        <>
          {timeLine}
          <span className="text-muted-foreground/80"> · </span>
          {locationText}
        </>
      }
      categoryPill={formatListingTileCategoryPillText(listing)}
      showFavorites={false}
    />
  )
}

function SoldFeedGrid({ listings }: { listings: SoldFeedListing[] }) {
  if (!listings.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Package className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No sales yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Be the first to sell something on Reswell.
        </p>
        <Link
          href="/boards"
          className="mt-6 text-sm font-medium text-cerulean hover:underline"
        >
          Browse surfboards →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => (
        <SoldListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}

export function RecentlySoldPageClient({
  soldListings,
  soldStats,
}: RecentlySoldPageClientProps) {
  return (
    <>
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Recently sold
          </h1>
          <p className="mt-1 text-muted-foreground">
            Surfboards that found new homes on Reswell
          </p>
        </div>
      </section>

      <section className="container mx-auto py-6">
        <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-center text-sm text-foreground">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            <span aria-hidden>🤝</span>
            <span className="font-medium tabular-nums">{soldStats.count}</span>
            <span>items sold on Reswell ·</span>
            <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
              {soldStats.gmvFormatted}
            </span>
            <span>in sales</span>
          </span>
        </div>
        <SoldFeedGrid listings={soldListings} />
      </section>
    </>
  )
}
