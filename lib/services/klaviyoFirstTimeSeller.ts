/**
 * Orchestrates first-time seller Klaviyo metrics after a listing is published.
 * Loads listing + primary image, checks prior publishes in-category, then tracks.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { sellerHasPriorPublishedListingInSection } from "@/lib/db/sellerFirstListing"
import {
  isFirstTimeSellerSection,
  trackKlaviyoFirstTimeSeller,
} from "@/lib/klaviyo/track-first-time-seller"

export type TrackFirstTimeSellerForListingInput = {
  listingId: string
  sellerUserId: string
  sellerEmail?: string | null
}

/**
 * Best-effort: fire first-time seller Klaviyo events when this publish is the
 * seller's first non-draft listing in a supported category. Never throws.
 */
export async function trackFirstTimeSellerForListingIfNeeded(
  supabase: SupabaseClient,
  input: TrackFirstTimeSellerForListingInput,
): Promise<void> {
  const listingId = input.listingId.trim()
  const sellerUserId = input.sellerUserId.trim()
  if (!listingId || !sellerUserId) return

  try {
    const { data: listing, error } = await supabase
      .from("listings")
      .select(
        "id, user_id, title, price, section, slug, status, local_pickup, shipping_available",
      )
      .eq("id", listingId)
      .maybeSingle()

    if (error || !listing) {
      console.error(
        "[klaviyoFirstTimeSeller] listing load failed:",
        error?.message ?? "not found",
      )
      return
    }

    if (listing.user_id !== sellerUserId) return
    if (listing.status === "draft") return
    if (!isFirstTimeSellerSection(listing.section)) return

    const hasPrior = await sellerHasPriorPublishedListingInSection(
      supabase,
      sellerUserId,
      listing.section,
      listingId,
    )
    if (hasPrior) return

    const { data: firstImage } = await supabase
      .from("listing_images")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle()

    const photoUrl =
      (firstImage?.thumbnail_url && String(firstImage.thumbnail_url).trim()) ||
      (firstImage?.url && String(firstImage.url).trim()) ||
      null

    const price =
      typeof listing.price === "number" ? listing.price : Number(listing.price)

    await trackKlaviyoFirstTimeSeller({
      sellerUserId,
      sellerEmail: input.sellerEmail,
      listingId: listing.id,
      listingSlug: typeof listing.slug === "string" ? listing.slug : null,
      section: listing.section,
      title: String(listing.title ?? ""),
      price: Number.isFinite(price) ? price : 0,
      photoUrl,
      localPickup: listing.local_pickup,
      shippingAvailable: listing.shipping_available,
    })
  } catch (e) {
    console.error(
      "[klaviyoFirstTimeSeller] skipped:",
      e instanceof Error ? e.message : e,
    )
  }
}
