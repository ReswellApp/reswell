import { Suspense } from "react"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering } from "@/lib/db/home-recently-sold-strip"
import { listRecentlySoldListingsForBrand } from "@/lib/db/brand-listings"
import { getBrandBySlug } from "@/lib/brands/server"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatGmv } from "@/lib/format-gmv"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
import type { RecentListing } from "@/components/recent-feed-client"
import { RecentlySoldPageClient, type SoldFeedListing } from "./sold-page-client"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
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

function mapRecentListingToSoldFeed(listing: RecentListing): SoldFeedListing {
  const listPrice = publicListingListPriceUsd(listing.price)
  const soldAt = listing.updated_at?.trim() || new Date().toISOString()
  return {
    id: listing.id,
    slug: listing.slug,
    user_id: listing.user_id,
    title: listing.title,
    price: listPrice,
    soldPrice: listPrice,
    condition: listing.condition ?? "",
    section: listing.section,
    city: listing.city ?? null,
    state: listing.state ?? null,
    board_type: listing.board_type ?? null,
    board_length: listing.board_length ?? null,
    sold_at: soldAt,
    listing_images: listing.listing_images,
    profiles: listing.profiles,
    categories: listing.categories,
  }
}

async function SoldPageData({ brandSlug }: { brandSlug: string | null }) {
  const supabase = await createClient()

  if (brandSlug) {
    const brand = await getBrandBySlug(supabase, brandSlug)
    if (!brand) {
      return (
        <RecentlySoldPageClient
          soldListings={[]}
          soldStats={{ count: 0, gmvFormatted: formatGmv(0) }}
          brandFilterName={null}
          brandUnknown
        />
      )
    }

    const soldRows = await listRecentlySoldListingsForBrand(
      supabase,
      { id: brand.id, name: brand.name },
      { limit: SOLD_LIMIT },
    )
    const soldListings = soldRows.map(mapRecentListingToSoldFeed)
    const stats = await getSoldFeedStats()

    return (
      <RecentlySoldPageClient
        soldListings={soldListings}
        soldStats={{ count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) }}
        brandFilterName={brand.name}
      />
    )
  }

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
      : supabase
          .from("listings")
          .select(soldSelect)
          .in("id", orderedListingIds)
          .eq("status", "sold"),
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

type SoldPageProps = {
  searchParams: Promise<{ brandSlug?: string }>
}

export default async function SoldPage({ searchParams }: SoldPageProps) {
  const { brandSlug: brandSlugRaw } = await searchParams
  const brandSlug = brandSlugRaw?.trim() || null

  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <>
            <section className="border-b border-border bg-background">
              <div className="container mx-auto py-8">
                <Skeleton className="h-8 w-48 max-w-[85%]" />
                <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              </div>
            </section>
            <section className="container mx-auto py-6">
              <Skeleton className="mb-6 h-12 w-full max-w-xl mx-auto rounded-lg" />
              <ListingTileGridSkeleton count={10} ariaLabel="Loading recently sold surfboards" />
            </section>
          </>
        }
      >
        <SoldPageData brandSlug={brandSlug} />
      </Suspense>
    </main>
  )
}
