/**
 * Re-send **Purchase Successful** for a stored order with fresh listing image + price breakdown.
 * Uses the same `uniqueId` as checkout (`purchase-successful-{orderId}`) so Klaviyo updates the event.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { fetchPrimaryListingImageUrlsForKlaviyo } from "@/lib/klaviyo/fetch-primary-listing-image-urls"
import {
  trackKlaviyoBuyerOrderConfirmed,
  type KlaviyoBuyerOrderLineItem,
} from "@/lib/klaviyo/track-buyer-order-confirmed"
import {
  fetchCheckoutPromoCodeById,
  type CheckoutPromoKind,
} from "@/lib/services/checkoutPromo"

export type ReemitPurchaseSuccessfulResult =
  | { ok: true; orderId: string; listingImageUrl: string | null }
  | { ok: false; error: string }

export async function reemitPurchaseSuccessfulForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ReemitPurchaseSuccessfulResult> {
  const trimmedId = orderId.trim()
  if (!trimmedId) return { ok: false, error: "Missing order id" }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, order_num, buyer_id, seller_id, listing_id, amount, shipping_amount, promo_discount_usd, promo_code_id, admin_promo_code_id, fulfillment_method, payment_method, pickup_code, shipping_address",
    )
    .eq("id", trimmedId)
    .maybeSingle()

  if (orderErr) {
    return { ok: false, error: orderErr.message }
  }
  if (!order?.listing_id) {
    return { ok: false, error: "Order not found" }
  }

  const { data: orderItemRows } = await supabase
    .from("order_items")
    .select("listing_id, item_price, sort_order, listings ( id, title, section, slug )")
    .eq("order_id", trimmedId)
    .order("sort_order", { ascending: true })

  type ListingEmbed = {
    id: string
    title: string | null
    section: string | null
    slug: string | null
  }

  const unwrapListing = (raw: ListingEmbed | ListingEmbed[] | null | undefined): ListingEmbed | null => {
    if (!raw) return null
    return Array.isArray(raw) ? raw[0] ?? null : raw
  }

  const lineRows = (orderItemRows ?? []).filter((row) => row.listing_id)
  const listingIds =
    lineRows.length > 0
      ? lineRows.map((row) => String(row.listing_id))
      : [String(order.listing_id)]

  const { data: primaryListing } = await supabase
    .from("listings")
    .select("id, title, section, slug")
    .eq("id", order.listing_id)
    .maybeSingle()

  if (!primaryListing) {
    return { ok: false, error: "Listing not found" }
  }

  let buyerEmail = order.buyer_id != null ? await getAuthEmailForUserId(order.buyer_id) : null
  if (
    !buyerEmail &&
    order.shipping_address &&
    typeof order.shipping_address === "object"
  ) {
    const ship = order.shipping_address as { email?: string | null }
    buyerEmail = ship.email?.trim() || null
  }

  const orderAmount = parseFloat(String(order.amount ?? 0))
  const shippingAmountUsd = Math.max(0, parseFloat(String(order.shipping_amount ?? 0)) || 0)
  const promoDiscountUsd = Math.max(0, parseFloat(String(order.promo_discount_usd ?? 0)) || 0)
  const itemSubtotalUsd = Math.round((orderAmount + promoDiscountUsd - shippingAmountUsd) * 100) / 100

  const listingImageUrls = await fetchPrimaryListingImageUrlsForKlaviyo(supabase, listingIds)
  const primaryListingId = String(order.listing_id)
  const primaryImageUrl = listingImageUrls.get(primaryListingId) ?? null

  const lineItems: KlaviyoBuyerOrderLineItem[] =
    lineRows.length > 0
      ? lineRows.map((row) => {
          const listing = unwrapListing(row.listings as ListingEmbed | ListingEmbed[] | null)
          const listingId = String(row.listing_id)
          return {
            listingId,
            listingTitle: String(listing?.title ?? primaryListing.title ?? ""),
            listingSection: String(listing?.section ?? primaryListing.section ?? "surfboards"),
            listingSlug: listing?.slug ?? null,
            listingImageUrl: listingImageUrls.get(listingId) ?? null,
            price: parseFloat(String(row.item_price ?? 0)) || 0,
            quantity: 1,
          }
        })
      : [
          {
            listingId: primaryListingId,
            listingTitle: String(primaryListing.title ?? ""),
            listingSection: String(primaryListing.section ?? "surfboards"),
            listingSlug: primaryListing.slug ?? null,
            listingImageUrl: primaryImageUrl,
            price: itemSubtotalUsd,
            quantity: 1,
          },
        ]

  const listingTitle =
    lineItems.length === 1
      ? lineItems[0]!.listingTitle
      : `${lineItems.length} items — ${lineItems
          .slice(0, 3)
          .map((l) => l.listingTitle)
          .join(" · ")}${lineItems.length > 3 ? "…" : ""}`

  const fulfillmentMethod =
    order.fulfillment_method === "pickup" ? "pickup" : "shipping"
  const paymentMethod =
    order.payment_method === "reswell_bucks"
      ? "reswell_bucks"
      : order.payment_method === "cash"
        ? "cash"
        : "stripe"

  const promoKind: CheckoutPromoKind | null = order.promo_code_id
    ? "newsletter"
    : order.admin_promo_code_id
      ? "admin_issued"
      : null
  const promoCodeId = String(order.promo_code_id ?? order.admin_promo_code_id ?? "").trim()
  const promoCode =
    promoDiscountUsd > 0 && promoCodeId
      ? await fetchCheckoutPromoCodeById(supabase, promoCodeId, promoKind)
      : null

  await trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: order.buyer_id ?? undefined,
    buyerEmail,
    orderId: trimmedId,
    orderNum: (order as { order_num?: string | null }).order_num ?? null,
    listingId: primaryListingId,
    listingTitle: listingTitle.slice(0, 500),
    listingSection: String(primaryListing.section ?? "surfboards"),
    listingSlug: primaryListing.slug ?? null,
    listingImageUrl: primaryImageUrl,
    lineItems,
    itemSubtotalUsd,
    shippingAmountUsd,
    promoDiscountUsd,
    promoCode,
    promoKind,
    amount: Number.isFinite(orderAmount) ? orderAmount : 0,
    fulfillmentMethod,
    pickupCode: (order as { pickup_code?: string | null }).pickup_code ?? null,
    paymentMethod,
  })

  return { ok: true, orderId: trimmedId, listingImageUrl: primaryImageUrl }
}
