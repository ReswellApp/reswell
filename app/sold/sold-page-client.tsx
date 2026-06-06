"use client"

import Link from "next/link"
import { formatDistanceToNowStrict } from "date-fns"
import { capitalizeWords, formatHomePeerListingConditionLine } from "@/lib/listing-labels"
import { ListingTile, ListingTileSoldStamp } from "@/components/listing-tile"
import {
  homePeerListingGridCardClass,
  homeUniformScrollBodyClass,
  homeUniformScrollLinkClass,
  homeUniformScrollMetaFooterClass,
  homeUniformScrollTitleSlotClass,
  homePeerListingTileTitleClass,
  homePeerTileSubtitleClass,
  homePeerTilePriceClass,
} from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"
import { Package, Truck } from "lucide-react"
import { listingDetailHref } from "@/lib/listing-href"
import {
  MarketplaceFeedSoldStatsBanner,
  MarketplaceFeedStatsBanner,
} from "@/components/features/marketplace/marketplace-feed-stats-banner"

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
  /** When set via `/sold?brandSlug=`, shown in the page header. */
  brandFilterName?: string | null
  brandUnknown?: boolean
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

function SoldListingCard({
  listing,
  showShippedLabel = false,
}: {
  listing: SoldFeedListing
  showShippedLabel?: boolean
}) {
  const href = listingDetailHref(listing)
  const locationText =
    listing.city && listing.state
      ? `${listing.city}, ${listing.state}`
      : listing.profiles?.location || "Location not set"
  const timeLine = soldRelativeLabel(listing.sold_at)
  const conditionLine = formatHomePeerListingConditionLine(listing.condition)

  return (
    <ListingTile
      href={href}
      listingId={listing.id}
      title={listing.title}
      imageAlt={capitalizeWords(listing.title)}
      listingImages={listing.listing_images ?? null}
      price={listing.price}
      imageTopLeftOverlay={<ListingTileSoldStamp />}
      linkLayout="unified"
      linkClassName={homeUniformScrollLinkClass}
      cardClassName={homePeerListingGridCardClass}
      cardContentClassName={homeUniformScrollBodyClass}
      showFavorites={false}
      favorites={null}
      titleSlot={
        <div className={homeUniformScrollTitleSlotClass}>
          <h3 className={homePeerListingTileTitleClass}>{capitalizeWords(listing.title)}</h3>
        </div>
      }
      subtitle={
        conditionLine ? <p className={homePeerTileSubtitleClass}>{conditionLine}</p> : null
      }
      footerSlot={
        <div className={homeUniformScrollMetaFooterClass}>
          <p
            className={cn(
              homePeerTilePriceClass,
              "text-[#163060]",
            )}
          >
            Sold for ${listing.soldPrice.toFixed(2)}
          </p>
          <div className="mt-1.5 space-y-0.5 text-xs font-normal leading-snug text-muted-foreground">
            <p>
              {timeLine}
              {!showShippedLabel ? (
                <>
                  <span className="text-muted-foreground/80"> · </span>
                  {locationText}
                </>
              ) : null}
            </p>
            {showShippedLabel ? (
              <p className="inline-flex items-center gap-1 text-foreground/80">
                <Truck className="h-3 w-3 shrink-0" aria-hidden />
                <span>This board was shipped</span>
              </p>
            ) : null}
          </div>
        </div>
      }
    />
  )
}

function SoldFeedGrid({
  listings,
  variant = "sold",
}: {
  listings: SoldFeedListing[]
  variant?: "sold" | "shipped"
}) {
  if (!listings.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {variant === "shipped" ? <Truck className="h-7 w-7" /> : <Package className="h-7 w-7" />}
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {variant === "shipped" ? "No shipped boards yet" : "No sales yet"}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {variant === "shipped"
            ? "When a buyer chooses shipping at checkout, the board will show up here."
            : "Be the first to sell something on Reswell."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-medium text-cerulean">
          <Link href="/boards" className="hover:underline">
            Browse surfboards →
          </Link>
          <Link href="/fins" className="hover:underline">
            Browse fins →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => (
        <SoldListingCard
          key={listing.id}
          listing={listing}
          showShippedLabel={variant === "shipped"}
        />
      ))}
    </div>
  )
}

export function SoldFeedPanel({
  soldListings,
  soldStats,
  variant = "sold",
}: Pick<RecentlySoldPageClientProps, "soldListings" | "soldStats"> & {
  variant?: "sold" | "shipped"
}) {
  return (
    <>
      {variant === "shipped" ? (
        <MarketplaceFeedStatsBanner>
          <span className="inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium tabular-nums">{soldListings.length}</span>
            <span>shipped boards on Reswell</span>
          </span>
        </MarketplaceFeedStatsBanner>
      ) : (
        <MarketplaceFeedSoldStatsBanner count={soldStats.count} gmvFormatted={soldStats.gmvFormatted} />
      )}
      <SoldFeedGrid listings={soldListings} variant={variant} />
    </>
  )
}
