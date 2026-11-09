import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRevalidateAfterMarketplaceOrderCommit } from "@/lib/cache/safe-revalidate-after-order"
import { deleteBuyerCartRowsForListings } from "@/lib/db/cart-items-server"
import { insertOrderAdAttribution } from "@/lib/db/orderAdAttribution"
import { markUserListingBoardModelDataSold } from "@/lib/db/user-listing-board-model-data"
import { insertOrderShipmentsForOrder } from "@/lib/db/orderShipments"
import { readAdAttributionFromCookies } from "@/lib/ads/read-request-attribution"
import { fetchPrimaryListingImageUrlsForKlaviyo } from "@/lib/klaviyo/fetch-primary-listing-image-urls"
import { trackKlaviyoBuyerOrderConfirmed } from "@/lib/klaviyo/track-buyer-order-confirmed"
import { trackMetaPurchaseServerEvent } from "@/lib/meta/track-purchase-server-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { postPurchaseThreadNotification } from "@/lib/purchase-thread-notification"
import { purchaseReswellShippingLabelAfterCheckout } from "@/lib/services/autoPurchaseReswellShippingLabelForOrder"
import { completeAcceptedOfferOnPurchase } from "@/lib/services/completeOfferOnPurchase"
import { redeemCheckoutPromoForOrder, type CheckoutPromoKind } from "@/lib/services/checkoutPromo"
import { notifySellerOrderCheckoutKlaviyo } from "@/lib/services/notifySellerOrderCheckoutKlaviyo"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { sendPostPurchaseReviewInvite } from "@/lib/services/orderReviewInvite"
import { postReswellBucksShippingLabelCost } from "@/lib/db/reswellBucksLedger"
import type { ReswellBucksLineCents } from "@/lib/services/reswellBucksSettlement"
import { DEFAULT_SHIPPING_PACKAGING_MODE, type ShippingPackagingMode } from "@/lib/shipping/packaging-mode"

export type ReswellBucksCheckoutListing = {
  id: string
  title?: string | null
  section?: string | null
  slug?: string | null
}

/**
 * Buyer funds are already settled. These steps match card checkout's after-commit work.
 * Failures are logged and do not unwind the journal.
 */
export async function runReswellBucksCheckoutSideEffects(
  supabase: SupabaseClient,
  params: {
    orderId: string
    orderNum: string | null
    buyerId: string
    buyerEmail: string | null
    sellerId: string
    listings: ReswellBucksCheckoutListing[]
    lines: ReswellBucksLineCents[]
    fulfillment: "pickup" | "shipping"
    pickupCode: string | null
    packagingMode: ShippingPackagingMode | null
    shippingAddress: Record<string, unknown> | null
    packageRateByListingId: Map<string, string | null>
    togetherRateId: string | null
    promo: { kind: CheckoutPromoKind; id: string } | null
    chargedUsd: number
    itemSubtotalUsd: number
    shippingUsd: number
    promoDiscountUsd: number
    platformFeeUsd: number
    sellerEarningsUsd: number
    offerId: string | null
  },
): Promise<void> {
  const listingIds = params.listings.map((listing) => listing.id)
  const primary = params.listings[0]
  if (!primary) return

  void insertOrderAdAttribution(supabase, params.orderId, await readAdAttributionFromCookies())

  if (params.fulfillment === "shipping") {
    const { data: orderItems, error } = await supabase
      .from("order_items")
      .select("id, listing_id, sort_order")
      .eq("order_id", params.orderId)
    if (error) {
      console.error("[reswell-bucks] order items for shipments", error.message)
    } else {
      const sorted = [...(orderItems ?? [])].sort(
        (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
      )
      const shipments = await insertOrderShipmentsForOrder({
        supabase,
        orderId: params.orderId,
        packagingMode: params.packagingMode ?? DEFAULT_SHIPPING_PACKAGING_MODE,
        lines: sorted.map((row) => ({
          orderItemId: String(row.id),
          listingId: String(row.listing_id),
          shipengineRateId:
            params.packagingMode === "separate"
              ? params.packageRateByListingId.get(String(row.listing_id)) ?? null
              : params.togetherRateId,
        })),
      })
      if (!shipments.ok) {
        console.error("[reswell-bucks] shipments", shipments.error)
      }
    }
  }

  if (params.promo) {
    const redeemed = await redeemCheckoutPromoForOrder(supabase, {
      kind: params.promo.kind,
      promoId: params.promo.id,
      buyerId: params.buyerId,
      orderId: params.orderId,
      paymentIntentId: null,
    })
    if (!redeemed.ok) {
      console.error("[reswell-bucks] promo redeem", {
        orderId: params.orderId,
        promoId: params.promo.id,
        error: redeemed.error,
      })
    }
  }

  await safeRevalidateAfterMarketplaceOrderCommit(supabase, {
    sellerUserId: params.sellerId,
    listingIds,
    listingSlugs: params.listings.map((listing) => listing.slug ?? null),
  })

  void completeAcceptedOfferOnPurchase(
    supabase,
    params.buyerId,
    listingIds,
    params.sellerId,
    params.offerId,
  )

  for (const listingId of listingIds) {
    void syncListingToGoogleMerchantBestEffort(supabase, listingId)
  }

  for (const line of params.lines) {
    void markUserListingBoardModelDataSold(supabase, line.listingId, line.itemPriceCents / 100)
  }

  void deleteBuyerCartRowsForListings(supabase, params.buyerId, listingIds)

  const titles = params.listings.map((listing) => String(listing.title ?? ""))
  void postPurchaseThreadNotification(supabase, {
    buyerId: params.buyerId,
    sellerId: params.sellerId,
    primaryListingId: primary.id,
    listingIds,
    listingTitles: titles,
    listingTitleSummary: titles.length === 1 ? titles[0]! : titles.join(", "),
    orderId: params.orderId,
    orderNum: formatOrderNumForCustomer(params.orderNum, params.orderId),
    total: params.chargedUsd,
    fulfillment: params.fulfillment,
    shippingAddress: params.shippingAddress,
    paymentMethod: "reswell_bucks",
  })

  const imageUrls = await fetchPrimaryListingImageUrlsForKlaviyo(supabase, listingIds)
  await trackKlaviyoBuyerOrderConfirmed({
    buyerUserId: params.buyerId,
    buyerEmail: params.buyerEmail,
    orderId: params.orderId,
    orderNum: params.orderNum,
    listingId: primary.id,
    listingTitle: String(primary.title ?? ""),
    listingSection: String(primary.section ?? ""),
    listingSlug: primary.slug ?? null,
    listingImageUrl: imageUrls.get(primary.id) ?? null,
    itemSubtotalUsd: params.itemSubtotalUsd,
    shippingAmountUsd: params.shippingUsd,
    promoDiscountUsd: params.promoDiscountUsd,
    amount: params.chargedUsd,
    platformFeeUsd: params.platformFeeUsd,
    sellerEarningsUsd: params.sellerEarningsUsd,
    fulfillmentMethod: params.fulfillment,
    pickupCode: params.pickupCode,
    paymentMethod: "reswell_bucks",
    lineItems: params.listings.map((listing) => ({
      listingId: listing.id,
      listingTitle: String(listing.title ?? ""),
      listingSection: String(listing.section ?? "surfboards"),
      listingSlug: listing.slug ?? null,
      listingImageUrl: imageUrls.get(listing.id) ?? null,
      price:
        (params.lines.find((line) => line.listingId === listing.id)?.itemPriceCents ?? 0) / 100,
      quantity: 1,
    })),
  })

  await notifySellerOrderCheckoutKlaviyo(supabase, params.orderId)

  void trackMetaPurchaseServerEvent({
    orderId: params.orderId,
    buyerUserId: params.buyerId,
    buyerEmail: params.buyerEmail,
    value: params.chargedUsd,
    contentIds: listingIds,
    includeBrowserSignals: true,
  })

  void sendPostPurchaseReviewInvite(params.orderId)

  if (params.fulfillment === "shipping") {
    await purchaseReswellShippingLabelAfterCheckout(supabase, params.orderId)
    await recognizeReswellBucksShippingLabels(supabase, params.orderId)
  }
}

async function recognizeReswellBucksShippingLabels(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const { data: shipments, error } = await supabase
    .from("order_shipments")
    .select("id")
    .eq("order_id", orderId)
  if (error) {
    console.error("[reswell-bucks] shipments for label cost", error.message)
    return
  }
  const shipmentIds = (shipments ?? [])
    .map((row) => String((row as { id?: string }).id ?? ""))
    .filter((id) => id.length > 0)
  if (shipmentIds.length === 0) return

  const { data: labels, error: labelError } = await supabase
    .from("order_shipping_labels")
    .select("id, label_cost_usd")
    .in("shipment_id", shipmentIds)
  if (labelError) {
    console.error("[reswell-bucks] label costs", labelError.message)
    return
  }

  for (const label of labels ?? []) {
    const row = label as { id?: string; label_cost_usd?: string | number | null }
    const labelId = typeof row.id === "string" ? row.id : ""
    const cost = typeof row.label_cost_usd === "number" ? row.label_cost_usd : Number(row.label_cost_usd)
    if (!labelId || !Number.isFinite(cost) || cost <= 0) continue
    await postReswellBucksShippingLabelCost(supabase, orderId, labelId, Math.round(cost * 100))
  }
}
