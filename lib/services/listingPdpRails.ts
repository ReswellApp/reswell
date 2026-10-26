import {
  mobileListingRailsSchema,
  type MobileListingCard,
  type MobileListingRails,
} from "@reswell/api-contract"
import { fetchMoreFromSellerListings, PDP_SELLER_LISTING_LIMIT } from "@/lib/db/listing-pdp-seller-listings"
import { hydrateHomePeerListingRows } from "@/lib/db/home-peer-listing-feed"
import { fetchSimilarPeerListingsForListingPdp } from "@/lib/db/listing-detail-similar-peer"
import { fetchSimilarSurfboardsForListingPdp } from "@/lib/db/listing-detail-similar-surfboards"
import { getCachedShopRelatedListings } from "@/lib/listing-detail-cache"
import { findListingByParam } from "@/lib/listing-query"
import {
  RECENTLY_VIEWED_RAIL_TITLE,
  SHOP_RELATED_RAIL_TITLE,
  sellerListingRailTitle,
  similarListingRailTitle,
} from "@/lib/listing-pdp-rail-titles"
import {
  isListingPubliclyVisible,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"
import type { MobileListingRow } from "@/lib/db/mobile-listings"
import { fetchSignedInPdpRecentlyViewedSurfboards } from "@/lib/services/pdp-recent-strip-listings"
import { toMobileListingCard, type MobileApiResult } from "@/lib/services/mobileApi"
import { getDb } from "@/lib/supabase/db"
import type { PeerSimilarFacetColumn } from "@/lib/utils/listing-detail-similar-peer"
import type { SupabaseClient } from "@supabase/supabase-js"

const RAIL_LISTING_SELECT = `
  id,
  user_id,
  title,
  status,
  price,
  section,
  board_type,
  fin_system,
  traction_size,
  wetsuit_size,
  apparel_kind,
  magazine_year,
  boardbag_size,
  leash_size,
  surfpack_size,
  hidden_from_site,
  archived_at
`

const PEER_FACET: Record<string, { column: PeerSimilarFacetColumn; field: string }> = {
  fins: { column: "fin_system", field: "fin_system" },
  traction: { column: "traction_size", field: "traction_size" },
  wetsuits: { column: "wetsuit_size", field: "wetsuit_size" },
  apparel: { column: "apparel_kind", field: "apparel_kind" },
  magazines: { column: "magazine_year", field: "magazine_year" },
  boardbags: { column: "boardbag_size", field: "boardbag_size" },
  leashes: { column: "leash_size", field: "leash_size" },
  surfpacks: { column: "surfpack_size", field: "surfpack_size" },
}

type RailListingRow = {
  id: string
  user_id: string
  title: string | null
  status: string
  price: unknown
  section: string
  board_type: string | null
  hidden_from_site: boolean | null
  archived_at: string | null
} & Record<string, unknown>

function priceUsd(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function cardsFromPeerRows(rows: Record<string, unknown>[]): MobileListingCard[] {
  return hydrateHomePeerListingRows(rows).flatMap((row) => {
    const card = toMobileListingCard(peerRowToMobileListing(row))
    return card ? [card] : []
  })
}

function peerRowToMobileListing(row: Record<string, unknown>): MobileListingRow {
  return {
    id: String(row.id ?? ""),
    slug: typeof row.slug === "string" ? row.slug : null,
    title: typeof row.title === "string" ? row.title : null,
    description: null,
    status: typeof row.status === "string" ? row.status : "active",
    price: typeof row.price === "number" || typeof row.price === "string" ? row.price : null,
    condition: typeof row.condition === "string" ? row.condition : null,
    section: typeof row.section === "string" ? row.section : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    model: typeof row.model === "string" ? row.model : null,
    board_type: typeof row.board_type === "string" ? row.board_type : null,
    dimensions: typeof row.dimensions === "string" ? row.dimensions : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    shipping_available: typeof row.shipping_available === "boolean" ? row.shipping_available : null,
    local_pickup: typeof row.local_pickup === "boolean" ? row.local_pickup : null,
    hidden_from_site: typeof row.hidden_from_site === "boolean" ? row.hidden_from_site : null,
    archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
    shipping_price:
      typeof row.shipping_price === "number" || typeof row.shipping_price === "string"
        ? row.shipping_price
        : null,
    board_shipping_cost_mode:
      typeof row.board_shipping_cost_mode === "string" ? row.board_shipping_cost_mode : null,
    listing_images: Array.isArray(row.listing_images) ? row.listing_images : null,
    profiles: null,
  }
}

function section(id: string, title: string, listings: MobileListingCard[]) {
  if (listings.length === 0) return null
  return { id, title, listings }
}

/**
 * The scrollable blocks under a public `/l` page: similar listings, more from
 * the seller, recently viewed surfboards, and shop “You may also like”.
 * Blog posts are not rendered under `/l` today, so they are not a rail.
 */
export async function getListingPdpRailsService(
  listingParam: string,
  viewer?: { supabase: SupabaseClient; userId: string },
): Promise<MobileApiResult<MobileListingRails>> {
  const catalog = getDb({ consistency: "eventual", purpose: "catalog" })
  const found = await findListingByParam(catalog, listingParam, { select: RAIL_LISTING_SELECT })
  if (found.queryFailed) {
    return { ok: false, status: 500, error: "Unable to load listing recommendations right now" }
  }
  const listing = found.listing as RailListingRow | null
  if (
    !listing ||
    !(isListingPubliclyVisible(listing) || isListingVisibleInPublicSoldFeed(listing))
  ) {
    return { ok: false, status: 404, error: "Listing not found" }
  }

  const sections = (
    listing.section === "new"
      ? await shopSections(listing.id)
      : await peerSections(catalog, listing, viewer)
  ).filter((item) => item != null)

  const parsed = mobileListingRailsSchema.safeParse({ sections })
  if (!parsed.success) {
    console.error("[mobile-api] listing rails shape failed", {
      timestamp: new Date().toISOString(),
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    })
    return { ok: false, status: 500, error: "Unable to load listing recommendations right now" }
  }
  return { ok: true, data: parsed.data }
}

async function shopSections(listingId: string) {
  const related = await getCachedShopRelatedListings(listingId)
  const inStock = related
    .filter((row) => Number((row as { stock_quantity?: number }).stock_quantity) > 0)
    .slice(0, 4)
    .map((row) => ({ ...(row as Record<string, unknown>), section: "new", status: "active" }))
  return [section("related", SHOP_RELATED_RAIL_TITLE, cardsFromPeerRows(inStock))]
}

async function peerSections(
  catalog: SupabaseClient,
  listing: RailListingRow,
  viewer?: { supabase: SupabaseClient; userId: string },
) {
  const facet = PEER_FACET[listing.section]
  const facetValue = facet ? listing[facet.field] : null
  const [similarRaw, sellerRaw, recent] = await Promise.all([
    listing.section === "surfboards"
      ? fetchSimilarSurfboardsForListingPdp(catalog, {
          excludeListingId: listing.id,
          boardType: listing.board_type,
          priceUsd: priceUsd(listing.price),
        })
      : facet
        ? fetchSimilarPeerListingsForListingPdp(catalog, {
            excludeListingId: listing.id,
            section: listing.section,
            priceUsd: priceUsd(listing.price),
            facet: {
              column: facet.column,
              value: typeof facetValue === "number" || typeof facetValue === "string" ? facetValue : null,
            },
          })
        : Promise.resolve([]),
    fetchMoreFromSellerListings(catalog, {
      sellerId: listing.user_id,
      section: listing.section,
      excludeListingId: listing.id,
      limit: PDP_SELLER_LISTING_LIMIT,
    }).then((rows) => rows as unknown as Record<string, unknown>[]),
    listing.section === "surfboards" && viewer
      ? fetchSignedInPdpRecentlyViewedSurfboards(viewer.supabase, viewer.userId, listing.id)
      : Promise.resolve([]),
  ])

  return [
    section("similar", similarListingRailTitle(listing.section), cardsFromPeerRows(similarRaw)),
    section("seller", sellerListingRailTitle(listing.section), cardsFromPeerRows(sellerRaw)),
    section(
      "recently_viewed",
      RECENTLY_VIEWED_RAIL_TITLE,
      cardsFromPeerRows(recent as unknown as Record<string, unknown>[]),
    ),
  ]
}
