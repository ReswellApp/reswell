import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getBuyerDisplayNameForKlaviyo,
  getSellerEmailForKlaviyo,
} from "@/lib/klaviyo/seller-sale-event-helpers"
import { trackKlaviyoSellerNewSaleReceived } from "@/lib/klaviyo/track-seller-new-sale-received"
import type { KlaviyoSellerNewSaleReceivedPayload } from "@/lib/klaviyo/track-seller-new-sale-received"
import {
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"

type OrderRowForSellerKlaviyo = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  listing_id: string
  amount: string | number
  platform_fee: string | number
  seller_earnings: string | number
  fulfillment_method: string | null
  payment_method: string | null
  shipping_address: unknown
}

function unwrapListing<R>(raw: R | R[] | null | undefined): R | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function listingTitleSummary(
  primaryTitle: string,
  lineTitles: string[],
): string {
  const cleaned = lineTitles.map((t) => t.trim()).filter(Boolean)
  if (cleaned.length <= 1) return primaryTitle.trim() || cleaned[0] || "Your sale"
  return `${cleaned.length} items — ${cleaned.slice(0, 3).join(" · ")}${cleaned.length > 3 ? "…" : ""}`
}

/**
 * Emits seller checkout Klaviyo metrics (**New Sale Received** + fulfillment-specific metric).
 * Idempotent per order via event `uniqueId`.
 */
export async function notifySellerOrderCheckoutKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      amount,
      platform_fee,
      seller_earnings,
      fulfillment_method,
      payment_method,
      shipping_address,
      listings ( id, title, section, slug )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    if (orderErr) {
      console.error("[notifySellerOrderCheckoutKlaviyo] order load:", orderErr.message)
    }
    return
  }

  const row = order as unknown as OrderRowForSellerKlaviyo & {
    listings: { id: string; title: string | null; section: string | null; slug: string | null } | { id: string; title: string | null; section: string | null; slug: string | null }[] | null
  }

  if (!row.seller_id || !row.buyer_id || row.seller_id === row.buyer_id) return

  const listing = unwrapListing(row.listings)
  if (!listing) return

  const { data: itemRows } = await supabase
    .from("order_items")
    .select(`sort_order, listings ( ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT} )`)
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })

  const lineListings: PeerListingForShippingQuote[] = []
  const lineTitles: string[] = []

  if (itemRows && itemRows.length > 0) {
    for (const item of itemRows) {
      const l = unwrapListing(
        (item as { listings?: PeerListingForShippingQuote | PeerListingForShippingQuote[] | null })
          .listings,
      )
      if (l) {
        lineListings.push(l)
        lineTitles.push(String(l.title ?? ""))
      }
    }
  }

  const listingsForShipping =
    lineListings.length > 0
      ? lineListings
      : await loadPrimaryListingForShipping(supabase, row.listing_id)

  const [sellerEmail, buyerDisplayName] = await Promise.all([
    getSellerEmailForKlaviyo(row.seller_id),
    getBuyerDisplayNameForKlaviyo(row.buyer_id),
  ])

  const fulfillmentMethod = row.fulfillment_method === "pickup" ? "pickup" : "shipping"
  const paymentMethod = row.payment_method === "reswell_bucks" ? "reswell_bucks" : "stripe"
  const shippingAddressJson =
    row.shipping_address &&
    typeof row.shipping_address === "object" &&
    !Array.isArray(row.shipping_address)
      ? (row.shipping_address as Record<string, unknown>)
      : null

  const payload: KlaviyoSellerNewSaleReceivedPayload = {
    sellerUserId: row.seller_id,
    sellerEmail,
    buyerUserId: row.buyer_id,
    buyerDisplayName,
    orderId: row.id,
    orderNum: row.order_num,
    listingId: listing.id,
    listingTitle: listingTitleSummary(
      String(listing.title ?? ""),
      lineTitles.length > 0 ? lineTitles : [String(listing.title ?? "")],
    ),
    listingSection: listing.section ?? "surfboards",
    listingSlug: listing.slug ?? null,
    orderAmount: Number(row.amount),
    sellerEarnings: Number(row.seller_earnings),
    platformFee: Number(row.platform_fee),
    fulfillmentMethod,
    paymentMethod,
    shippingAddressJson,
    listingsForShipping,
  }

  await trackKlaviyoSellerNewSaleReceived(payload)
}

async function loadPrimaryListingForShipping(
  supabase: SupabaseClient,
  listingId: string,
): Promise<PeerListingForShippingQuote[]> {
  const { data } = await supabase
    .from("listings")
    .select(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (!data) return []
  return [data as unknown as PeerListingForShippingQuote]
}

/**
 * Inline checkout path when order context is already loaded (avoids an extra round trip).
 */
export async function notifySellerOrderCheckoutKlaviyoFromPayload(
  payload: KlaviyoSellerNewSaleReceivedPayload,
): Promise<void> {
  await trackKlaviyoSellerNewSaleReceived(payload)
}
