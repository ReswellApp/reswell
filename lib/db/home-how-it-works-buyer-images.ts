import type { SupabaseClient } from "@supabase/supabase-js"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"

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

/**
 * Latest active surfboard listing card image per board type (for homepage “I'm buying”).
 */
export async function listHowItWorksBuyerListingImageUrls(
  supabase: SupabaseClient,
): Promise<HowItWorksBuyerListingImageUrls> {
  const [shortboard, hybrid, longboard] = await Promise.all([
    fetchLatestCardImageForBoardType(supabase, "shortboard"),
    fetchLatestCardImageForBoardType(supabase, "hybrid"),
    fetchLatestCardImageForBoardType(supabase, "longboard"),
  ])
  return { shortboard, hybrid, longboard }
}
