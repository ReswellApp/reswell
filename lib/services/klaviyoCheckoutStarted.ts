import type { SupabaseClient } from "@supabase/supabase-js"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { isBlockedOwnListingPurchase } from "@/lib/cart-eligibility"
import {
  fetchCheckoutCartListingsForSeller,
} from "@/lib/db/checkout-cart-bundle"
import { fetchAcceptedOfferForBuyerListing } from "@/lib/db/offers"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  trackKlaviyoCheckoutStarted,
  type KlaviyoCheckoutStartedListing,
} from "@/lib/klaviyo/track-checkout-started"
import { findListingByParam } from "@/lib/listing-query"
import type { KlaviyoCheckoutStartedBody } from "@/lib/validations/klaviyoCheckoutStarted"
import type { User } from "@supabase/supabase-js"

function rowToCheckoutListing(row: Record<string, unknown>): KlaviyoCheckoutStartedListing {
  return {
    id: String(row.id ?? ""),
    slug: (row.slug as string | null | undefined) ?? null,
    title: String(row.title ?? ""),
    user_id: String(row.user_id ?? ""),
    section: String((row as { section?: string | null }).section ?? "surfboards"),
    price: row.price as string | number,
    shipping_available: (row.shipping_available as boolean | null | undefined) ?? null,
    local_pickup: (row.local_pickup as boolean | null | undefined) ?? null,
    shipping_price: (row.shipping_price as string | number | null | undefined) ?? null,
    listing_images:
      (row.listing_images as KlaviyoCheckoutStartedListing["listing_images"]) ?? null,
  }
}

export type RecordKlaviyoCheckoutStartedResult =
  | { ok: true; skipped?: boolean; skipReason?: string }
  | { ok: false; error: string }

export async function recordKlaviyoCheckoutStarted(
  supabase: SupabaseClient,
  user: User,
  body: KlaviyoCheckoutStartedBody,
): Promise<RecordKlaviyoCheckoutStartedResult> {
  if (isAnonymousSupabaseUser(user)) {
    return { ok: true, skipped: true, skipReason: "anonymous_user" }
  }

  const buyerEmail =
    user.email?.trim() ||
    (await getAuthEmailForUserId(user.id)) ||
    null

  if (body.from_cart === true) {
    const sellerId = body.seller_id?.trim() ?? ""
    if (!sellerId) {
      return { ok: false, error: "seller_id required for cart checkout" }
    }

    const bundle = await fetchCheckoutCartListingsForSeller(supabase, user.id, sellerId)
    if ("error" in bundle) {
      return { ok: false, error: bundle.error }
    }
    if (bundle.listings.length === 0) {
      return { ok: true, skipped: true, skipReason: "empty_cart" }
    }

    const checkoutListings = bundle.listings.map(rowToCheckoutListing)
    const bundleSellerUid = checkoutListings[0]?.user_id?.trim()
    if (
      !bundleSellerUid ||
      bundleSellerUid !== sellerId ||
      checkoutListings.some((listing) => (listing.user_id ?? "").trim() !== bundleSellerUid)
    ) {
      return { ok: true, skipped: true, skipReason: "invalid_cart_seller" }
    }

    if (
      checkoutListings.some((listing) =>
        isBlockedOwnListingPurchase(
          { user_id: listing.user_id ?? "", section: listing.section },
          user.id,
        ),
      )
    ) {
      return { ok: true, skipped: true, skipReason: "own_listing" }
    }

    await trackKlaviyoCheckoutStarted({
      buyerUserId: user.id,
      buyerEmail,
      listings: checkoutListings,
      checkoutPath: `/checkout?from_cart=1&seller_id=${encodeURIComponent(sellerId)}`,
      fromCart: true,
      sellerId,
    })

    return { ok: true }
  }

  const listingParam = body.listing?.trim() ?? ""
  if (!listingParam) {
    return { ok: false, error: "listing required" }
  }

  const { listing } = await findListingByParam(supabase, listingParam, {
    select:
      "id, slug, title, price, user_id, status, section, shipping_available, local_pickup, shipping_price, listing_images ( url, thumbnail_url, is_primary )",
    section: undefined,
  })

  if (!listing || (listing.status !== "active" && listing.status !== "pending_sale")) {
    return { ok: true, skipped: true, skipReason: "listing_unavailable" }
  }

  if (listing.section !== "surfboards") {
    return { ok: true, skipped: true, skipReason: "unsupported_section" }
  }

  if (listing.user_id === user.id) {
    return { ok: true, skipped: true, skipReason: "own_listing" }
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    return { ok: true, skipped: true, skipReason: "no_fulfillment" }
  }

  let checkoutListing = rowToCheckoutListing(listing as unknown as Record<string, unknown>)
  const acceptedOffer = await fetchAcceptedOfferForBuyerListing(supabase, user.id, listing.id)
  if (acceptedOffer && acceptedOffer.seller_id === listing.user_id) {
    const agreed = Math.round(parseFloat(String(acceptedOffer.current_amount)) * 100) / 100
    if (Number.isFinite(agreed) && agreed > 0) {
      checkoutListing = { ...checkoutListing, price: agreed }
    }
  }

  const checkoutParam = listing.slug?.trim() || listing.id
  const checkoutPath = `/checkout?listing=${encodeURIComponent(checkoutParam)}`

  await trackKlaviyoCheckoutStarted({
    buyerUserId: user.id,
    buyerEmail,
    listings: [checkoutListing],
    checkoutPath,
    fromCart: false,
    sellerId: listing.user_id,
  })

  return { ok: true }
}
