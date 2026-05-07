import type { SupabaseClient } from "@supabase/supabase-js"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { getHowItWorksBuyerCuratedListingId } from "@/lib/db/home-how-it-works-buyer-curation"

export type HowItWorksBuyerBoardType = "shortboard" | "hybrid" | "longboard"

export type HowItWorksBuyerListingImageUrls = Record<HowItWorksBuyerBoardType, string | null>

const LISTING_IMAGE_SELECT = "listing_images (url, thumbnail_url, sort_order, is_primary)"

async function fetchLatestCardImageForBoardType(
  supabase: SupabaseClient,
  boardType: HowItWorksBuyerBoardType,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_IMAGE_SELECT)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("board_type", boardType)
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(`fetchLatestCardImageForBoardType (${boardType}):`, error.message)
    return null
  }
  if (!data) return null

  const images = data.listing_images as ListingImageForCard[] | null
  const src = listingCardImageSrc(images)
  return src || null
}

function rowEligibleForHowItWorks(
  listing: Pick<ListingMinimalForHowItWorks, "status" | "hidden_from_site" | "hidden_from_homepage" | "section" | "board_type"> | null,
  boardType: HowItWorksBuyerBoardType,
): boolean {
  if (!listing) return false
  if (listing.status !== "active") return false
  if (listing.hidden_from_site === true) return false
  if (listing.hidden_from_homepage === true) return false
  if (listing.section !== "surfboards") return false
  return listing.board_type === boardType
}

type ListingMinimalForHowItWorks = {
  listing_images?: ListingImageForCard[] | null
  status: string | null
  hidden_from_site: boolean | null
  hidden_from_homepage: boolean | null
  section: string | null
  board_type: string | null
}

async function resolveHowItWorksImageForBoardType(
  supabase: SupabaseClient,
  boardType: HowItWorksBuyerBoardType,
): Promise<string | null> {
  const curatedId = await getHowItWorksBuyerCuratedListingId(supabase, boardType)
  if (curatedId) {
    const { data: curatedListing, error: curErr } = await supabase
      .from("listings")
      .select(`${LISTING_IMAGE_SELECT}, status, hidden_from_site, hidden_from_homepage, section, board_type`)
      .eq("id", curatedId)
      .maybeSingle()

    if (curErr) {
      console.error(`resolveHowItWorksImageForBoardType curated (${boardType}):`, curErr.message)
    } else if (curatedListing && rowEligibleForHowItWorks(curatedListing as ListingMinimalForHowItWorks, boardType)) {
      const imgs = curatedListing.listing_images as ListingImageForCard[] | null
      return listingCardImageSrc(imgs)
    }
  }
  return fetchLatestCardImageForBoardType(supabase, boardType)
}

/**
 * Buyer tab images: admin-curated per board type when set and eligible; otherwise latest active listing photo.
 */
export async function listHowItWorksBuyerListingImageUrls(
  supabase: SupabaseClient,
): Promise<HowItWorksBuyerListingImageUrls> {
  const [shortboard, hybrid, longboard] = await Promise.all([
    resolveHowItWorksImageForBoardType(supabase, "shortboard"),
    resolveHowItWorksImageForBoardType(supabase, "hybrid"),
    resolveHowItWorksImageForBoardType(supabase, "longboard"),
  ])
  return { shortboard, hybrid, longboard }
}
