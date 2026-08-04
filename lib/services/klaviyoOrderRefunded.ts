/**
 * Load order + listing context and emit Klaviyo **Order Refunded** for buyer and seller.
 * Best-effort — never throws; failures are logged only.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { fetchPrimaryListingImageUrlsForKlaviyo } from "@/lib/klaviyo/fetch-primary-listing-image-urls"
import {
  trackKlaviyoOrderRefunded,
  type KlaviyoOrderRefundedLineItem,
  type KlaviyoOrderRefundedPayload,
} from "@/lib/klaviyo/track-order-refunded"

type ListingRow = {
  id: string
  title: string | null
  section: string | null
  slug: string | null
  brand: string | null
  board_type: string | null
  condition: string | null
  city: string | null
  state: string | null
  dimensions: string | null
  price: string | number | null
}

type ListingEmbed = {
  id: string
  title: string | null
  section: string | null
  slug: string | null
  brand: string | null
  board_type: string | null
  condition: string | null
  city: string | null
  state: string | null
  dimensions: string | null
}

function unwrapListing(raw: ListingEmbed | ListingEmbed[] | null | undefined): ListingEmbed | null {
  if (!raw) return null
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

function displayNameFromProfile(
  row: { display_name?: string | null; shop_name?: string | null; is_shop?: boolean | null } | null,
  fallback: string,
): string {
  if (!row) return fallback
  if (row.is_shop && typeof row.shop_name === "string" && row.shop_name.trim()) {
    return row.shop_name.trim()
  }
  if (typeof row.display_name === "string" && row.display_name.trim()) {
    return row.display_name.trim()
  }
  return fallback
}

function lineFromListing(
  listing: ListingEmbed | ListingRow,
  opts: { price: number; quantity?: number; imageUrl?: string | null },
): KlaviyoOrderRefundedLineItem {
  return {
    listingId: listing.id,
    listingTitle:
      typeof listing.title === "string" && listing.title.trim() ? listing.title.trim() : "Listing",
    listingSection: typeof listing.section === "string" ? listing.section : null,
    listingSlug: typeof listing.slug === "string" ? listing.slug : null,
    listingImageUrl: opts.imageUrl ?? null,
    price: opts.price,
    quantity: opts.quantity ?? 1,
    brand: typeof listing.brand === "string" ? listing.brand : null,
    boardType: typeof listing.board_type === "string" ? listing.board_type : null,
    condition: typeof listing.condition === "string" ? listing.condition : null,
    city: typeof listing.city === "string" ? listing.city : null,
    state: typeof listing.state === "string" ? listing.state : null,
    dimensions: typeof listing.dimensions === "string" ? listing.dimensions : null,
  }
}

export type EmitKlaviyoOrderRefundedResult =
  | {
      ok: true
      orderId: string
      orderNum: string | null
      buyerStatus: number
      sellerStatus: number
      uniqueIdSuffix: string | null
    }
  | { ok: false; error: string }

export async function emitKlaviyoOrderRefundedForOrder(
  supabase: SupabaseClient,
  orderId: string,
  opts: {
    refundType: "stripe" | "wallet"
    source?: string
    /** Append to Klaviyo unique_id so re-emits create a new event / re-trigger flows. */
    uniqueIdSuffix?: string
  },
): Promise<EmitKlaviyoOrderRefundedResult> {
  try {
    const trimmedId = orderId.trim()
    if (!trimmedId) return { ok: false, error: "Missing order id" }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select(
        "id, order_num, buyer_id, seller_id, listing_id, amount, seller_earnings, payment_method, fulfillment_method, refunded_at, shipping_address",
      )
      .eq("id", trimmedId)
      .maybeSingle()

    if (orderErr || !order?.buyer_id || !order.seller_id) {
      const error = orderErr?.message ?? "Order not found or missing buyer/seller"
      console.error("[klaviyo Order Refunded] order load failed", error)
      return { ok: false, error }
    }

    const { data: orderItemRows } = await supabase
      .from("order_items")
      .select(
        "listing_id, item_price, sort_order, listings ( id, title, section, slug, brand, board_type, condition, city, state, dimensions )",
      )
      .eq("order_id", trimmedId)
      .order("sort_order", { ascending: true })

    let primaryListing: ListingRow | null = null
    if (order.listing_id) {
      const { data } = await supabase
        .from("listings")
        .select(
          "id, title, section, slug, brand, board_type, condition, city, state, dimensions, price",
        )
        .eq("id", order.listing_id)
        .maybeSingle()
      primaryListing = (data as ListingRow | null) ?? null
    }

    const lineRows = (orderItemRows ?? []).filter((row) => row.listing_id)
    const listingIds =
      lineRows.length > 0
        ? lineRows.map((row) => String(row.listing_id))
        : order.listing_id
          ? [String(order.listing_id)]
          : []

    const imageUrls = await fetchPrimaryListingImageUrlsForKlaviyo(supabase, listingIds)

    const lineItems: KlaviyoOrderRefundedLineItem[] =
      lineRows.length > 0
        ? lineRows.map((row) => {
            const listing = unwrapListing(row.listings as ListingEmbed | ListingEmbed[] | null)
            const listingId = String(row.listing_id)
            const price = Number(row.item_price ?? 0)
            if (listing) {
              return lineFromListing(listing, {
                price: Number.isFinite(price) ? price : 0,
                imageUrl: imageUrls.get(listingId) ?? null,
              })
            }
            return {
              listingId,
              listingTitle: "Listing",
              price: Number.isFinite(price) ? price : 0,
              quantity: 1,
              listingImageUrl: imageUrls.get(listingId) ?? null,
            }
          })
        : primaryListing
          ? [
              lineFromListing(primaryListing, {
                price: Number(primaryListing.price ?? order.amount ?? 0) || Number(order.amount ?? 0),
                imageUrl: imageUrls.get(primaryListing.id) ?? null,
              }),
            ]
          : []

    const primary =
      primaryListing ??
      (lineItems[0]
        ? {
            id: lineItems[0].listingId,
            title: lineItems[0].listingTitle,
            section: lineItems[0].listingSection ?? null,
            slug: lineItems[0].listingSlug ?? null,
            brand: lineItems[0].brand ?? null,
            board_type: lineItems[0].boardType ?? null,
            condition: lineItems[0].condition ?? null,
            city: lineItems[0].city ?? null,
            state: lineItems[0].state ?? null,
            dimensions: lineItems[0].dimensions ?? null,
            price: lineItems[0].price,
          }
        : null)

    const profileIds = [order.buyer_id, order.seller_id]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, shop_name, is_shop")
      .in("id", profileIds)

    const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]))

    let buyerEmail = await getAuthEmailForUserId(order.buyer_id)
    if (
      !buyerEmail &&
      order.shipping_address &&
      typeof order.shipping_address === "object"
    ) {
      const ship = order.shipping_address as { email?: string | null }
      buyerEmail = ship.email?.trim() || null
    }
    const sellerEmail = await getAuthEmailForUserId(order.seller_id)

    const shared: Omit<KlaviyoOrderRefundedPayload, "recipientRole"> = {
      buyerUserId: order.buyer_id,
      buyerEmail,
      buyerDisplayName: displayNameFromProfile(profileById.get(order.buyer_id) ?? null, "Buyer"),
      sellerUserId: order.seller_id,
      sellerEmail,
      sellerDisplayName: displayNameFromProfile(
        profileById.get(order.seller_id) ?? null,
        "Seller",
      ),
      orderId: order.id,
      orderNum: typeof order.order_num === "string" ? order.order_num : null,
      listingId: primary?.id ?? (typeof order.listing_id === "string" ? order.listing_id : null),
      listingTitle:
        typeof primary?.title === "string" && primary.title.trim()
          ? primary.title.trim()
          : "Listing",
      listingSection: typeof primary?.section === "string" ? primary.section : null,
      listingSlug: typeof primary?.slug === "string" ? primary.slug : null,
      listingImageUrl: primary?.id ? (imageUrls.get(primary.id) ?? null) : null,
      listingBrand: typeof primary?.brand === "string" ? primary.brand : null,
      listingBoardType: typeof primary?.board_type === "string" ? primary.board_type : null,
      listingCondition: typeof primary?.condition === "string" ? primary.condition : null,
      listingCity: typeof primary?.city === "string" ? primary.city : null,
      listingState: typeof primary?.state === "string" ? primary.state : null,
      listingDimensions: typeof primary?.dimensions === "string" ? primary.dimensions : null,
      amount: Number(order.amount ?? 0),
      sellerEarnings:
        order.seller_earnings != null ? Number(order.seller_earnings) : null,
      paymentMethod: typeof order.payment_method === "string" ? order.payment_method : null,
      fulfillmentMethod:
        typeof order.fulfillment_method === "string" ? order.fulfillment_method : null,
      refundType: opts.refundType,
      refundedAt: typeof order.refunded_at === "string" ? order.refunded_at : null,
      source: opts.source ?? "admin",
      uniqueIdSuffix: opts.uniqueIdSuffix ?? null,
      lineItems,
    }

    const [buyerResult, sellerResult] = await Promise.all([
      trackKlaviyoOrderRefunded({ ...shared, recipientRole: "buyer" }),
      trackKlaviyoOrderRefunded({ ...shared, recipientRole: "seller" }),
    ])

    if (!buyerResult.ok && !sellerResult.ok) {
      return {
        ok: false,
        error:
          buyerResult.skipReason ||
          sellerResult.skipReason ||
          buyerResult.detail ||
          sellerResult.detail ||
          "Klaviyo rejected both Order Refunded events",
      }
    }

    return {
      ok: true,
      orderId: order.id,
      orderNum: typeof order.order_num === "string" ? order.order_num : null,
      buyerStatus: buyerResult.status,
      sellerStatus: sellerResult.status,
      uniqueIdSuffix: opts.uniqueIdSuffix ?? null,
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error("[klaviyo Order Refunded] emit failed:", error)
    return { ok: false, error }
  }
}
