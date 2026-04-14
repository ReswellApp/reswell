import { Suspense } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatGmv } from "@/lib/format-gmv"
import type { RecentListing } from "@/components/recent-feed-client"
import { formatDecimalDimension } from "@/lib/board-measurements"
import { FeedPageClient, type SoldFeedListing, type SoldTickerItem } from "./feed-page-client"

const LIMIT = 50
const SOLD_LIMIT = 40

export const metadata: Metadata = {
  title: "Feed — new listings & recently sold | Reswell",
  description:
    "Browse the latest surfboard listings on Reswell, plus recently sold items — a live view of marketplace activity.",
}

function mapActiveRow(
  row: Record<string, unknown>,
  section: string,
): RecentListing & { created_at: string } {
  const inchesNum =
    row.length_inches != null && Number.isFinite(Number(row.length_inches))
      ? Number(row.length_inches)
      : null
  const boardLength =
    row.length_feet != null && inchesNum != null
      ? `${row.length_feet}'${formatDecimalDimension(inchesNum) || "0"}"`
      : row.length_feet != null
        ? `${row.length_feet}'`
        : null
  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: Number(row.price ?? 0),
    condition: String(row.condition ?? ""),
    section: row.section != null ? String(row.section) : section,
    status: row.status != null ? String(row.status) : "active",
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    shipping_available: Boolean(row.shipping_available),
    local_pickup: row.local_pickup !== false,
    board_type: row.board_type != null ? String(row.board_type) : null,
    board_length: boardLength,
    listing_images: row.listing_images as RecentListing["listing_images"],
    profiles: row.profiles as RecentListing["profiles"],
    categories: row.categories as RecentListing["categories"],
    created_at: row.created_at != null ? String(row.created_at) : new Date(0).toISOString(),
  }
}

function mapSoldRow(row: Record<string, unknown>): SoldFeedListing {
  const inchesNum =
    row.length_inches != null && Number.isFinite(Number(row.length_inches))
      ? Number(row.length_inches)
      : null
  const boardLength =
    row.length_feet != null && inchesNum != null
      ? `${row.length_feet}'${formatDecimalDimension(inchesNum) || "0"}"`
      : row.length_feet != null
        ? `${row.length_feet}'`
        : null
  const soldAtRaw = row.sold_at ?? row.updated_at
  const soldAt = soldAtRaw ? String(soldAtRaw) : new Date().toISOString()
  const listPrice = Number(row.price ?? 0)
  const soldPriceRaw = row.sold_price
  const soldPrice =
    soldPriceRaw != null && soldPriceRaw !== "" ? Number(soldPriceRaw) : listPrice

  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: listPrice,
    soldPrice: Number.isFinite(soldPrice) ? soldPrice : listPrice,
    condition: String(row.condition ?? ""),
    section: String(row.section ?? "surfboards"),
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    board_type: row.board_type != null ? String(row.board_type) : null,
    board_length: boardLength,
    sold_at: soldAt,
    listing_images: row.listing_images as SoldFeedListing["listing_images"],
    profiles: row.profiles as SoldFeedListing["profiles"],
    categories: row.categories as SoldFeedListing["categories"],
  }
}

async function FeedData() {
  const supabase = await createClient()

  const soldSelect = `
    id,
    slug,
    user_id,
    title,
    price,
    condition,
    section,
    city,
    state,
    updated_at,
    board_type,
    length_feet,
    length_inches,
    listing_images (url, is_primary),
    profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count),
    categories (name, slug)
  `

  const [
    { data: { user } },
    boardsRes,
    soldRes,
    stats,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("listings")
      .select(`
        id,
        slug,
        user_id,
        title,
        price,
        condition,
        section,
        status,
        created_at,
        city,
        state,
        shipping_available,
        local_pickup,
        board_type,
        length_feet,
        length_inches,
        listing_images (url, is_primary),
        profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count),
        categories (name, slug)
      `)
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("listings")
      .select(soldSelect)
      .eq("status", "sold")
      .eq("hidden_from_site", false)
      .in("section", ["surfboards"])
      .order("updated_at", { ascending: false })
      .limit(SOLD_LIMIT),
    getSoldFeedStats(),
  ])

  const soldListings: SoldFeedListing[] = ((soldRes.data ?? []) as Record<string, unknown>[]).map(
    mapSoldRow,
  )

  let favoritedListingIds: string[] = []
  if (user) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
    favoritedListingIds = (favs ?? []).map((f) => f.listing_id)
  }

  const withCreated = (res: Record<string, unknown>[], section: string) =>
    res.map((row) => mapActiveRow(row, section))

  const merged = withCreated((boardsRes.data ?? []) as Record<string, unknown>[], "surfboards")
  const feedListings: RecentListing[] = merged
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, LIMIT)
    .map(({ created_at: _c, ...rest }) => rest)

  const tickerItems: SoldTickerItem[] = soldListings.slice(0, 10).map((l) => ({
    id: l.id,
    title: l.title,
    price: l.soldPrice,
    city: l.city ?? null,
    state: l.state ?? null,
  }))

  const gmvFormatted = formatGmv(stats.gmvTotal)

  return (
    <FeedPageClient
      listings={feedListings}
      soldListings={soldListings}
      favoritedListingIds={favoritedListingIds}
      isLoggedIn={!!user}
      viewerUserId={user?.id ?? null}
      soldStats={{ count: stats.soldCount, gmvFormatted }}
      initialTickerItems={tickerItems}
    />
  )
}

export default function FeedPage() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="border-b border-border bg-background">
            <div className="container mx-auto py-8">
              <div className="h-8 w-48 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
            </div>
          </div>
        }
      >
        <FeedData />
      </Suspense>
    </main>
  )
}
