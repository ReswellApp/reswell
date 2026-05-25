import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchListingForOffer, type ListingRowForOffer } from "@/lib/db/offers"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { trackKlaviyoSellerMadeOfferToBuyer } from "@/lib/klaviyo/track-seller-made-offer-to-buyer"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import { formatSellerOfferThreadContent } from "@/lib/utils/format-offer-thread-content"
import type { OfferLineItem } from "@/lib/types/offer-line-item"
import {
  normalizeSellerOfferLineItems,
  type SellerInitiatedOfferBody,
} from "@/lib/validations/seller-initiated-offer"
import { randomUUID } from "node:crypto"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type CreateSellerInitiatedOfferResult =
  | { ok: true; offerId: string; conversationId: string | null }
  | { ok: false; status: number; error: string }

async function findActiveNegotiationForBuyerListing(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .in("status", ["PENDING", "COUNTERED"])
    .maybeSingle()

  if (error || !data) return null
  return { id: data.id as string }
}

function defaultShippingAmount(listing: ListingRowForOffer): number {
  const raw = listing.shipping_price
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"))
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : 0
}

function validateListingForSellerOffer(
  listing: ListingRowForOffer,
  sellerUserId: string,
  lineAmount: number,
): { ok: true; listPrice: number; minOffer: number; minPct: number } | { ok: false; error: string } {
  if (listing.hidden_from_site) {
    return { ok: false, error: "One or more listings were not found." }
  }
  if (listing.user_id !== sellerUserId) {
    return { ok: false, error: "You can only include your own listings in an offer." }
  }
  if (listing.section !== "surfboards") {
    return { ok: false, error: "Offers are not available for one or more listing types." }
  }
  if (listing.status !== "active" && listing.status !== "pending_sale") {
    return { ok: false, error: "One or more listings are not accepting offers." }
  }
  if (listing.buyer_offers_enabled === false) {
    return { ok: false, error: "You are not accepting offers on one or more items." }
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return { ok: false, error: "One or more listings do not have a valid price." }
  }

  const minPct = effectiveMinimumOfferPct(listing)
  const minOffer = roundMoney(listPrice * (minPct / 100))
  const amount = roundMoney(lineAmount)

  if (amount < minOffer) {
    return {
      ok: false,
      error: `Each offer price must be at least ${minPct}% of list price (e.g. $${minOffer.toFixed(2)} for “${(listing.title ?? "listing").trim() || "listing"}”).`,
    }
  }
  if (amount > listPrice) {
    return {
      ok: false,
      error: `Offer prices cannot exceed list price (max $${listPrice.toFixed(2)} for “${(listing.title ?? "listing").trim() || "listing"}”).`,
    }
  }

  return { ok: true, listPrice, minOffer, minPct }
}

/**
 * Listing owner proposes a price (and optional bundle + fulfillment) to a buyer.
 * Persists as status COUNTERED with `seller_initiated` so the buyer can accept/decline.
 */
export async function createSellerInitiatedOffer(
  supabase: SupabaseClient,
  sellerUserId: string,
  anchorListingId: string,
  body: SellerInitiatedOfferBody,
): Promise<CreateSellerInitiatedOfferResult> {
  const { buyerUserId, message: rawMessage, fulfillment } = body
  const message =
    typeof rawMessage === "string" && rawMessage.trim() !== "" ? rawMessage.trim() : undefined

  if (buyerUserId === sellerUserId) {
    return { ok: false, status: 400, error: "Invalid buyer." }
  }

  const normalizedLineItems = normalizeSellerOfferLineItems(body, anchorListingId)
  if (normalizedLineItems.length === 0) {
    return { ok: false, status: 400, error: "Add at least one listing to the offer." }
  }

  if (!normalizedLineItems.some((row) => row.listingId === anchorListingId)) {
    return {
      ok: false,
      status: 400,
      error: "The current listing must be included in the offer.",
    }
  }

  const isBundle = normalizedLineItems.length > 1
  if (isBundle && fulfillment !== "pickup") {
    return {
      ok: false,
      status: 400,
      error: "Bundled offers support local pickup only. Choose pickup or offer items separately for shipping.",
    }
  }

  const listingsById = new Map<string, ListingRowForOffer>()
  for (const row of normalizedLineItems) {
    const listing = await fetchListingForOffer(supabase, row.listingId)
    if (!listing) {
      return { ok: false, status: 404, error: "One or more listings were not found." }
    }
    const validated = validateListingForSellerOffer(listing, sellerUserId, row.amount)
    if (!validated.ok) {
      return { ok: false, status: 400, error: validated.error }
    }
    listingsById.set(row.listingId, listing)
  }

  if (fulfillment === "pickup") {
    const missingPickup = normalizedLineItems.find((row) => {
      const listing = listingsById.get(row.listingId)
      return listing && listing.local_pickup === false
    })
    if (missingPickup) {
      return {
        ok: false,
        status: 400,
        error: "Every item in a pickup offer must allow local pickup.",
      }
    }
  }

  if (fulfillment === "shipping") {
    if (isBundle) {
      return {
        ok: false,
        status: 400,
        error: "Shipping offers support one item at a time.",
      }
    }
    const singleListing = listingsById.get(normalizedLineItems[0]!.listingId)
    if (!singleListing?.shipping_available) {
      return { ok: false, status: 400, error: "Shipping is not available for this listing." }
    }
  }

  for (const row of normalizedLineItems) {
    const active = await findActiveNegotiationForBuyerListing(supabase, row.listingId, buyerUserId)
    if (active) {
      const listing = listingsById.get(row.listingId)
      const title = (listing?.title ?? "this listing").trim() || "this listing"
      return {
        ok: false,
        status: 409,
        error: `There is already an open offer with this buyer on “${title}”. Resolve it first or continue in messages.`,
      }
    }
  }

  const lineItems: OfferLineItem[] = normalizedLineItems.map((row) => {
    const listing = listingsById.get(row.listingId)!
    return {
      listing_id: row.listingId,
      amount: row.amount,
      title: (listing.title ?? "").trim() || undefined,
    }
  })

  const itemsSubtotal = roundMoney(lineItems.reduce((sum, row) => sum + row.amount, 0))

  let shippingAmount: number | null = null
  if (fulfillment === "shipping") {
    const singleListing = listingsById.get(normalizedLineItems[0]!.listingId)!
    shippingAmount =
      body.shippingAmount != null
        ? roundMoney(body.shippingAmount)
        : defaultShippingAmount(singleListing)
  }

  const primaryListingId = normalizedLineItems[0]!.listingId
  const primaryListing = listingsById.get(primaryListingId)!
  const listPrice = roundMoney(parseFloat(String(primaryListing.price)))

  const note = message ? message.slice(0, 200) : null

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error("[createSellerInitiatedOffer] service client:", e)
    return { ok: false, status: 503, error: "Offers are temporarily unavailable." }
  }

  const offerExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const timelineEntry = {
    id: randomUUID(),
    sender_id: sellerUserId,
    sender_role: "SELLER" as const,
    action: "COUNTER",
    amount: itemsSubtotal,
    note,
    created_at: new Date().toISOString(),
  }

  const { data: inserted, error: offerErr } = await service
    .from("offers")
    .insert({
      listing_id: primaryListingId,
      buyer_id: buyerUserId,
      seller_id: sellerUserId,
      status: "COUNTERED",
      initial_amount: itemsSubtotal,
      current_amount: itemsSubtotal,
      counter_count: 0,
      seller_initiated: true,
      expires_at: offerExpiresAt,
      offer_timeline: [timelineEntry],
      fulfillment,
      shipping_amount: shippingAmount,
      line_items: lineItems,
    })
    .select("id")
    .single()

  if (offerErr || !inserted?.id) {
    console.error("[createSellerInitiatedOffer] insert offer:", offerErr)
    return { ok: false, status: 500, error: "Could not send your offer. Try again in a moment." }
  }

  const offerId = inserted.id as string

  const counterText = formatSellerOfferThreadContent({
    itemsSubtotal,
    fulfillment,
    shippingAmount,
    lineItems,
    note,
  })

  const threadResult = await appendConversationMessageWithClient(service, {
    buyerId: buyerUserId,
    sellerId: sellerUserId,
    listingId: anchorListingId,
    senderId: sellerUserId,
    content: counterText,
    offerId,
  })

  if (!threadResult.ok) {
    console.error("[createSellerInitiatedOffer] thread mirror failed")
  }

  const title = (primaryListing.title ?? "your listing").trim() || "your listing"
  const notifAmount =
    fulfillment === "shipping" && shippingAmount != null
      ? itemsSubtotal + shippingAmount
      : itemsSubtotal

  const { error: notifErr } = await service.from("notifications").insert({
    user_id: buyerUserId,
    type: "offer_countered",
    listing_id: primaryListingId,
    actor_id: sellerUserId,
    message: isBundle
      ? `${title}: the seller offered a bundle for $${notifAmount.toFixed(2)}.`
      : `${title}: the seller offered $${notifAmount.toFixed(2)}.`,
  })

  if (notifErr) {
    console.error("[createSellerInitiatedOffer] notification:", notifErr)
  }

  void trackKlaviyoSellerMadeOfferToBuyer({
    offerId,
    counterRound: 1,
    listingId: primaryListingId,
    listingTitle: title,
    listingSlug: primaryListing.slug?.trim() ? primaryListing.slug : null,
    listingSection: primaryListing.section,
    listPrice,
    offerAmount: itemsSubtotal,
    buyerUserId,
    sellerUserId,
    counterNote: note,
  })

  return {
    ok: true,
    offerId,
    conversationId: threadResult.ok ? threadResult.conversationId : null,
  }
}
