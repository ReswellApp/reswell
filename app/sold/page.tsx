import { Suspense } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatGmv } from "@/lib/format-gmv"
import { formatDecimalDimension } from "@/lib/board-measurements"
import { RecentlySoldPageClient, type SoldFeedListing, type SoldTickerItem } from "./sold-page-client"
import { pageSeoMetadata } from "@/lib/site-metadata"

const SOLD_LIMIT = 40

export const metadata: Metadata = pageSeoMetadata({
  title: "Recently sold surfboards | Reswell",
  description:
    "See surfboards that recently sold on Reswell — live marketplace activity and completed sales.",
  path: "/sold",
})

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

async function SoldPageData() {
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

  const [soldQuery, stats] = await Promise.all([
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

  const soldListings: SoldFeedListing[] = ((soldQuery.data ?? []) as Record<string, unknown>[]).map(
    mapSoldRow,
  )

  const tickerItems: SoldTickerItem[] = soldListings.slice(0, 10).map((l) => ({
    id: l.id,
    title: l.title,
    price: l.soldPrice,
    city: l.city ?? null,
    state: l.state ?? null,
  }))

  const gmvFormatted = formatGmv(stats.gmvTotal)

  return (
    <RecentlySoldPageClient
      soldListings={soldListings}
      soldStats={{ count: stats.soldCount, gmvFormatted }}
      initialTickerItems={tickerItems}
    />
  )
}

export default function SoldPage() {
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
        <SoldPageData />
      </Suspense>
    </main>
  )
}
