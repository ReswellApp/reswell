"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { formatDistanceToNowStrict } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { capitalizeWords, formatListingTileCategoryPillText } from "@/lib/listing-labels"
import { ListingTile } from "@/components/listing-tile"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { RecentFeedClient, type RecentListing } from "@/app/(site)/used/recent/recent-feed-client"
import { Package } from "lucide-react"
import { cn } from "@/lib/utils"

export type SoldTickerItem = {
  id: string
  title: string
  price: number
  city: string | null
  state: string | null
}

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

export interface FeedPageClientProps {
  listings: RecentListing[]
  soldListings: SoldFeedListing[]
  favoritedListingIds: string[]
  isLoggedIn: boolean
  soldStats: { count: number; gmvFormatted: string }
  initialTickerItems: SoldTickerItem[]
}

function getListingHref(listing: { section: string; slug: string | null; id: string }): string {
  const id = listing.slug || listing.id
  switch (listing.section) {
    case "used":
      return `/used/${id}`
    case "surfboards":
      return `/boards/${id}`
    default:
      return `/used/${id}`
  }
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
  const href = getListingHref(listing)
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
          href="/used"
          className="mt-6 text-sm font-medium text-cerulean hover:underline"
        >
          Browse listings →
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

function FeedTicker({
  items,
  show,
}: {
  items: SoldTickerItem[]
  show: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const doubled = useMemo(() => [...items, ...items], [items])

  if (!show || items.length === 0) return null

  return (
    <div className="border-b border-border bg-muted/40 overflow-hidden py-2 text-sm text-foreground/90">
      <div ref={trackRef} className="feed-ticker-marquee-track flex w-max gap-10 whitespace-nowrap px-4">
        {doubled.map((item, i) => {
          const loc =
            item.city && item.state ? `${item.city} · ${item.state}` : "Reswell"
          return (
            <span key={`${item.id}-${i}`} className="inline-flex shrink-0 items-center gap-1">
              <span className="text-muted-foreground">Just sold:</span>{" "}
              <span className="font-medium">{capitalizeWords(item.title)}</span>{" "}
              <span className="text-muted-foreground">· {loc}</span>{" "}
              <span className="tabular-nums text-foreground">${item.price.toFixed(0)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function FeedPageClient({
  listings,
  soldListings,
  favoritedListingIds,
  isLoggedIn,
  soldStats,
  initialTickerItems,
}: FeedPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const tab = searchParams.get("tab") === "sold" ? "sold" : "new"
  const [newListingCount, setNewListingCount] = useState(0)
  const [tickerItems, setTickerItems] = useState<SoldTickerItem[]>(initialTickerItems)

  const setTab = useCallback(
    (next: "new" | "sold") => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "sold") params.set("tab", "sold")
      else params.delete("tab")
      const q = params.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/feed/sold-ticker")
        if (!res.ok) return
        const data = (await res.json()) as { items?: SoldTickerItem[] }
        if (data.items?.length) setTickerItems(data.items)
      } catch {
        /* ignore */
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (tab !== "new") return

    const channel = supabase
      .channel("new_listings_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings", filter: "status=eq.active" },
        (payload) => {
          const row = payload.new as { section?: string }
          if (row.section !== "used" && row.section !== "surfboards") return
          setNewListingCount((prev) => prev + 1)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, tab])

  const showTicker = soldStats.count >= 5

  const onRefreshNewListings = useCallback(() => {
    setNewListingCount(0)
    window.scrollTo({ top: 0, behavior: "smooth" })
    router.refresh()
  }, [router])

  return (
    <>
      <FeedTicker items={tickerItems} show={showTicker} />

      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            New listings feed
          </h1>
          <p className="mt-1 text-muted-foreground">
            Latest used gear and surfboards on the marketplace
          </p>

          <div className="mt-6 flex gap-6 border-b border-border">
            <button
              type="button"
              onClick={() => setTab("new")}
              className={cn(
                "-mb-px border-b-2 pb-3 text-[15px] transition-colors",
                tab === "new"
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              New Listings
            </button>
            <button
              type="button"
              onClick={() => setTab("sold")}
              className={cn(
                "-mb-px border-b-2 pb-3 text-[15px] transition-colors",
                tab === "sold"
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent font-normal text-muted-foreground hover:text-foreground",
              )}
            >
              Recently Sold
            </button>
          </div>
        </div>
      </section>

      <section className="container mx-auto py-6">
        {tab === "new" && newListingCount > 0 && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={onRefreshNewListings}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              ↑ {newListingCount} new listing{newListingCount === 1 ? "" : "s"} — click to refresh
            </button>
          </div>
        )}

        {tab === "new" ? (
          <RecentFeedClient
            listings={listings}
            favoritedListingIds={favoritedListingIds}
            isLoggedIn={isLoggedIn}
          />
        ) : (
          <>
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
          </>
        )}
      </section>
    </>
  )
}
