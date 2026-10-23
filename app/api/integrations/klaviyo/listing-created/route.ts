import { NextRequest, NextResponse } from "next/server"
import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { createClient } from "@/lib/supabase/server"
import { trackKlaviyoListingCreated } from "@/lib/klaviyo/track-listing-created"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"
import { notifyBoardSavedSearchMatchesForListing } from "@/lib/services/notifyBoardSavedSearchMatches"
import { notifyFollowersNewListingKlaviyo } from "@/lib/services/notifyFollowersNewListingKlaviyo"
import { listingIsEligibleForBoardSavedSearchAlert } from "@/lib/services/savedSearchAlertEligibility"

/**
 * Called from `/sell` after a listing is live (insert or draft→publish) so Klaviyo runs server-side
 * with a verified session and row ownership. Flow trigger metric: **Listing** (see `track-listing-created`).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { listing_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const listingId = typeof body.listing_id === "string" ? body.listing_id.trim() : ""
  if (!listingId) {
    return NextResponse.json({ error: "listing_id required" }, { status: 400 })
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, user_id, title, price, local_pickup, shipping_available, status, hidden_from_site, archived_at, section",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  const managed = await resolveManagedSeller("listings.write")
  if (!managed.ok) {
    return NextResponse.json({ error: managed.error }, { status: managed.status })
  }
  if (listing.user_id !== managed.seller.sellerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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

  await trackKlaviyoListingCreated({
    sellerUserId: managed.seller.sellerId,
    sellerEmail: managed.seller.actingAsShop ? null : user.email ?? null,
    listingId: listing.id,
    title: String(listing.title ?? ""),
    price: typeof listing.price === "number" ? listing.price : Number(listing.price),
    photoUrl,
    localPickup: listing.local_pickup,
    shippingAvailable: listing.shipping_available,
  })

  void trackFirstTimeSellerForListingIfNeeded(supabase, {
    listingId: listing.id,
    sellerUserId: managed.seller.sellerId,
    sellerEmail: managed.seller.actingAsShop ? null : user.email ?? null,
  })

  const listingLive = listingIsEligibleForBoardSavedSearchAlert({
    section: listing.section,
    status: listing.status,
    title: listing.title,
    hidden_from_site: listing.hidden_from_site,
    archived_at: listing.archived_at,
  })

  if (listingLive) {
    void notifyBoardSavedSearchMatchesForListing(listing.id)
    void notifyFollowersNewListingKlaviyo(listing.id)
  }

  return NextResponse.json({ ok: true })
}
