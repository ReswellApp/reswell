import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { findListingByParam } from "@/lib/listing-query"
import {
  fetchBoardsBrowsePreviewForUnavailableLanding,
  fetchRelatedSurfboardsForUnavailableListing,
  UNAVAILABLE_LISTING_CONTEXT_SELECT,
  type UnavailableListingContextRow,
} from "@/lib/db/unavailable-listing-landing"
import type { BoardBrowseListingRow } from "@/lib/db/boards-browse-listings"
import {
  listActiveListingsForBrand,
  listRecentlySoldListingsForBrand,
} from "@/lib/db/brand-listings"
import { brandActiveListingsBrowseHref, brandSoldListingsBrowseHref } from "@/lib/brands/routes"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import { marketplaceBrandCandidatesFromListingSlug } from "@/lib/utils/listing-slug-brand-hints"
import { capitalizeWords } from "@/lib/listing-labels"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"

const BRAND_PREVIEW_LIMIT = 6

export type UnavailableListingBrandContext = {
  id: string
  name: string
  slug: string
}

export type UnavailableListingLandingModel = {
  listingTitle: string | null
  brand: UnavailableListingBrandContext | null
  brandLiveListings: RecentListing[]
  brandSoldListings: RecentListing[]
  /** When no directory brand matches, surfboard browse matches in brand-style grid. */
  fallbackLiveListings: RecentListing[]
  fallbackSectionTitle: string | null
  viewAllActiveHref: string | null
  viewSoldHref: string | null
  browseBoards: BoardBrowseListingRow[]
}

export async function buildUnavailableListingLanding(
  supabase: SupabaseClient,
  listingParam: string,
  existingListing?: UnavailableListingContextRow | null,
): Promise<UnavailableListingLandingModel> {
  let listing = existingListing ?? null
  if (!listing) {
    const { listing: row } = await findListingByParam(supabase, listingParam, {
      select: UNAVAILABLE_LISTING_CONTEXT_SELECT,
      section: undefined,
      includeHiddenListings: true,
    })
    listing = row as UnavailableListingContextRow | null
  }

  const slugHint =
    listing?.slug?.trim() ||
    (!listing && !/^[0-9a-f-]{36}$/i.test(listingParam) ? listingParam.trim() : "")

  const brandCandidates = [
    listing?.brand?.trim() ?? "",
    listing?.title?.trim() ?? "",
    ...marketplaceBrandCandidatesFromListingSlug(slugHint),
  ].filter((c) => c.length >= 2)

  let resolvedBrand: UnavailableListingBrandContext | null = null
  if (listing?.brand_id?.trim()) {
    const { data: brandRow } = await supabase
      .from("brands")
      .select("id, name, slug")
      .eq("id", listing.brand_id.trim())
      .maybeSingle()
    if (brandRow?.id && brandRow.slug && brandRow.name) {
      resolvedBrand = {
        id: brandRow.id,
        name: brandRow.name,
        slug: brandRow.slug,
      }
    }
  }

  for (const candidate of brandCandidates) {
    if (resolvedBrand) break
    const directory = await resolveDirectoryBrandRowFromLabel(supabase, candidate)
    if (directory) {
      resolvedBrand = {
        id: directory.id,
        name: directory.name,
        slug: directory.slug,
      }
    }
  }

  const excludeId = listing?.id

  let brandLiveListings: RecentListing[] = []
  let brandSoldListings: RecentListing[] = []
  let viewAllActiveHref: string | null = null
  let viewSoldHref: string | null = null

  if (resolvedBrand) {
    const brandRef = { id: resolvedBrand.id, name: resolvedBrand.name }
    const [live, sold] = await Promise.all([
      listActiveListingsForBrand(supabase, brandRef, {
        limit: BRAND_PREVIEW_LIMIT,
        sections: ["surfboards"],
      }),
      listRecentlySoldListingsForBrand(supabase, brandRef, { limit: BRAND_PREVIEW_LIMIT }),
    ])
    brandLiveListings = excludeListingFromRecent(live, excludeId)
    brandSoldListings = excludeListingFromRecent(sold, excludeId)
    viewAllActiveHref = brandActiveListingsBrowseHref(resolvedBrand)
    viewSoldHref = brandSoldListingsBrowseHref(resolvedBrand)
  }

  let fallbackLiveListings: RecentListing[] = []
  let fallbackSectionTitle: string | null = null

  if (
    !resolvedBrand &&
    listing?.section !== "new" &&
    (listing?.brand?.trim() || listing?.board_type)
  ) {
    const relatedRaw = await fetchRelatedSurfboardsForUnavailableListing(supabase, {
      excludeListingId: excludeId,
      brandId: listing?.brand_id,
      brandLabel: listing?.brand,
      boardType: listing?.board_type,
    })
    fallbackLiveListings = relatedRaw.map((row) =>
      mapBrowseRowToRecentListing(row as BoardBrowseListingRow),
    )
    fallbackSectionTitle = listing?.brand?.trim()
      ? `${listing.brand.trim()} boards`
      : "Similar surfboards"
    viewAllActiveHref = listing?.brand?.trim()
      ? `/boards?brand=${encodeURIComponent(listing.brand.trim())}`
      : "/boards"
  }

  const browseBoards = await fetchBoardsBrowsePreviewForUnavailableLanding(supabase)

  const listingTitle = listing?.title?.trim()
    ? capitalizeWords(listing.title)
    : slugHint
      ? capitalizeWords(brandHintTitleFromSlug(slugHint))
      : null

  return {
    listingTitle,
    brand: resolvedBrand,
    brandLiveListings,
    brandSoldListings,
    fallbackLiveListings,
    fallbackSectionTitle,
    viewAllActiveHref,
    viewSoldHref,
    browseBoards,
  }
}

function excludeListingFromRecent(
  rows: RecentListing[],
  excludeListingId: string | undefined,
): RecentListing[] {
  if (!excludeListingId) return rows
  return rows.filter((r) => r.id !== excludeListingId)
}

function mapBrowseRowToRecentListing(row: BoardBrowseListingRow): RecentListing {
  const dimensions =
    typeof (row as { dimensions?: string | null }).dimensions === "string"
      ? (row as { dimensions?: string | null }).dimensions
      : null
  return {
    id: row.id,
    slug: row.slug,
    user_id: row.user_id,
    title: row.title,
    price: Number(row.price),
    condition: row.condition ?? null,
    section: "surfboards",
    status: row.status,
    local_pickup: row.local_pickup,
    shipping_available: row.shipping_available ?? undefined,
    board_type: row.board_type,
    board_length: boardLengthLabelFromDimensionsColumn(dimensions) ?? null,
    listing_images: row.listing_images as RecentListing["listing_images"],
    profiles: (row as { profiles?: RecentListing["profiles"] }).profiles ?? null,
    categories: row.categories as RecentListing["categories"],
  }
}

function brandHintTitleFromSlug(slug: string): string {
  const words = slug.replace(/-/g, " ").trim()
  if (!words) return "Surfboard listing"
  return words.length > 80 ? `${words.slice(0, 77)}…` : words
}
