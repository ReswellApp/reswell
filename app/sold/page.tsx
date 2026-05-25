import { Suspense } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering } from "@/lib/db/home-recently-sold-strip"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatGmv } from "@/lib/format-gmv"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
import { RecentlySoldPageClient, type SoldFeedListing } from "./sold-page-client"
import { pageSeoMetadata } from "@/lib/site-metadata"

const SOLD_LIMIT = 40

export const metadata: Metadata = pageSeoMetadata({
  title: "Recently sold surfboards | Reswell",
  description:
    "See surfboards that recently sold on Reswell — live marketplace activity and completed sales.",
  path: "/sold",
})

function mapSoldRow(
  row: Record<string, unknown>,
  saleConfirmedAtIso: string | null,
): SoldFeedListing {
  const dimStr = row.dimensions != null ? String(row.dimensions) : ""
  const boardLength = boardLengthLabelFromDimensionsColumn(dimStr) ?? null
  const soldAtRaw = saleConfirmedAtIso ?? row.sold_at ?? row.updated_at
  const soldAt = soldAtRaw ? String(soldAtRaw) : new Date().toISOString()
  const listPrice = publicListingListPriceUsd(row.price as string | number | null | undefined)

  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: listPrice,
    /** Always original list price — offer discounts are private to buyer/seller. */
    soldPrice: listPrice,
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

  const { orderedListingIds, confirmedAtIsoByListingId } =
    await fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(supabase, SOLD_LIMIT)

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
    dimensions,
    listing_images (url, is_primary),
    profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count),
    categories (name, slug)
  `

  const [soldRes, stats] = await Promise.all([
    orderedListingIds.length === 0
      ? Promise.resolve({
          data: [] as Record<string, unknown>[] | null,
          error: null as { message: string } | null,
        })
      : supabase.from("listings").select(soldSelect).in("id", orderedListingIds),
    getSoldFeedStats(),
  ])

  if (soldRes.error) {
    console.error("[sold page] listings fetch:", soldRes.error.message)
  }

  const soldRows = (soldRes.data ?? []) as Record<string, unknown>[]
  const mapById = new Map(soldRows.map((r) => [String(r.id), r]))
  const soldListings: SoldFeedListing[] = orderedListingIds
    .map((id) => {
      const row = mapById.get(id)
      if (!row) return null
      const at = confirmedAtIsoByListingId.get(id) ?? null
      return mapSoldRow(row, at)
    })
    .filter((x): x is SoldFeedListing => x != null)

  const gmvFormatted = formatGmv(stats.gmvTotal)

  return (
    <RecentlySoldPageClient
      soldListings={soldListings}
      soldStats={{ count: stats.soldCount, gmvFormatted }}
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
