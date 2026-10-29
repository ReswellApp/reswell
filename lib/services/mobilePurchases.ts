import {
  mobilePurchaseDetailSchema,
  mobilePurchaseListItemSchema,
  mobilePurchasesSchema,
  type MobilePurchaseDetail,
  type MobilePurchaseListItem,
  type MobilePurchaseReview,
} from "@reswell/api-contract"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { getMarketplaceReviewByOrderAndReviewer } from "@/lib/db/order-reviews"
import { getOrderReturnSummariesByOrderIds } from "@/lib/db/orderReturnStatusSummary"
import {
  getMobilePurchaseDetailRow,
  listMobilePurchaseRows,
  type MobilePurchaseDetailRow,
  type MobilePurchaseListing,
  type MobilePurchaseListRow,
} from "@/lib/db/mobile-purchases"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { existingMarketplaceReviewFromRow } from "@/lib/marketplace-review-photos"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { orderStatusIsRefunded, orderStatusLocksDuringRefund } from "@/lib/order-status"
import { absoluteProfileCircleUrl } from "@/lib/profile-circle"
import {
  buildPurchaseDetailTimeline,
  purchaseDetailStatusDate,
} from "@/lib/purchase-detail-timeline"
import {
  purchaseDetailLine,
  purchaseRefundNote,
  purchaseShowsShipping,
  purchaseStatusTone,
  splitPurchaseAmount,
} from "@/lib/purchases-list-display"
import { resolveSaleCardStatusDisplay, type OrderReturnSummaryForStatus } from "@/lib/sale-card-status"
import { canSubmitSellerReview } from "@/lib/services/orderSellerReview"
import { ensureOrderBrandedTrackingUrl } from "@/lib/services/ensureOrderBrandedTrackingUrl"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import {
  daysUntilShippingDeadline,
  getShippingDeadlineDate,
  isEligibleForShippingDeadlineAutoCancel,
  SHIPPING_DEADLINE_DAYS,
} from "@/lib/shipping-deadline"
import {
  fetchOptionalOrderTrackingDetailJson,
  parseOrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { absolutePublicMediaUrl, absoluteUrl } from "@/lib/site-metadata"
import { packageTrackHref } from "@/lib/utils/carrier-tracking-url"
import { formatUsd } from "@/lib/utils/format-usd"
import type { ExistingMarketplaceReview } from "@/lib/types/marketplace-review"
import type { SupabaseClient } from "@supabase/supabase-js"

type ShippingAddressJson = {
  name?: string | null
  phone?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
} | null

function usd(value: number | string | null | undefined): number {
  if (value == null) return 0
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function listingImageUrl(listing: MobilePurchaseListing | null): string | null {
  const src = listingTitleThumbnailSrc(listing?.listing_images ?? null)
  return src ? absolutePublicMediaUrl(src) ?? null : null
}

function sellerDisplayName(name: string | null | undefined, sellerId: string): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  return `Seller ${sellerId.slice(0, 8)}…`
}

function asShippingAddress(value: unknown): ShippingAddressJson {
  if (!value || typeof value !== "object") return null
  return value as ShippingAddressJson
}

function hasShippingAddress(ship: ShippingAddressJson): boolean {
  const addr = ship?.address
  if (!addr) return false
  return [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country].some(
    (part) => typeof part === "string" && part.trim().length > 0,
  )
}

function fulfillmentLabel(method: string | null, hasShipAddr: boolean): string {
  if (method === "shipping" || hasShipAddr) return "Ship to you"
  if (method === "pickup") return "Local pickup"
  return "Local pickup"
}

function formatAddressLines(addr: NonNullable<ShippingAddressJson>["address"]): string[] {
  if (!addr) return []
  const cityLine = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")
  const country = addr.country?.trim() ?? ""
  const showCountry = country.length > 0 && !/^(us|usa|united states)$/i.test(country)
  return [addr.line1, addr.line2, cityLine, showCountry ? country : null].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  )
}

function toReview(review: ExistingMarketplaceReview | null): MobilePurchaseReview | null {
  if (!review) return null
  const rating = Math.round(review.rating)
  if (rating < 1 || rating > 5) return null
  return {
    id: review.id,
    rating,
    comment: text(review.comment),
  }
}

function absoluteTrackUrl(href: string | null): string | null {
  if (!href) return null
  if (/^https?:\/\//i.test(href)) return href
  return absoluteUrl(href)
}

export function toMobilePurchaseListItem(
  row: MobilePurchaseListRow,
  returnSummary: OrderReturnSummaryForStatus | null,
): MobilePurchaseListItem | null {
  const listing = row.listing
  const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
  const imageUrl = listingImageUrl(listing)
  const sellerName = sellerDisplayName(row.seller_name, row.seller_id)
  const shipped = hasShippingAddress(asShippingAddress(row.shipping_address))
  const fulfill = fulfillmentLabel(row.fulfillment_method, shipped)
  const amounts = splitPurchaseAmount(usd(row.amount), usd(row.shipping_amount))
  const trackingDetail = parseOrderTrackingDetail(row.tracking_detail)
  const statusDisplay = resolveSaleCardStatusDisplay({
    orderStatus: row.status,
    deliveryStatus: row.delivery_status ?? "pending",
    trackingNumber: row.tracking_number,
    trackingDetail,
    returnSummary,
    fulfillmentMethod: row.fulfillment_method,
    hasShippingAddress: shipped,
  })
  const item: MobilePurchaseListItem = {
    id: row.id,
    order_number: formatOrderNumForCustomer(row.order_num, row.id),
    status: row.status,
    status_label: statusDisplay.label,
    delivery_status: text(row.delivery_status),
    amount_usd: usd(row.amount),
    amount_label: formatUsd(usd(row.amount)),
    fulfillment_label: fulfill,
    created_at: row.created_at,
    tracking_number: text(row.tracking_number),
    listing_id: listing?.id ?? null,
    listing_title: title,
    listing_image_url: imageUrl,
    counterparty_name: sellerName,
    seller_name: sellerName,
    detail_line: purchaseDetailLine(listing?.condition, fulfill),
    item_amount_usd: amounts.itemAmount,
    item_amount_label: formatUsd(amounts.itemAmount),
    shipping_amount_usd: amounts.shippingAmount,
    shipping_amount_label: formatUsd(amounts.shippingAmount),
    show_shipping: purchaseShowsShipping(fulfill, amounts.shippingAmount),
    amount_struck: orderStatusIsRefunded(row.status),
    refund_note: purchaseRefundNote(row.status, usd(row.amount)),
    status_tone: purchaseStatusTone(statusDisplay),
  }
  const parsed = mobilePurchaseListItemSchema.safeParse(item)
  return parsed.success ? parsed.data : null
}

export async function listMobilePurchasesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ orders: MobilePurchaseListItem[] }>> {
  const listed = await listMobilePurchaseRows(supabase, userId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load orders right now" }

  const returnSummaries = await getOrderReturnSummariesByOrderIds(
    supabase,
    listed.rows.map((row) => row.id),
  )
  const orders = listed.rows
    .map((row) => toMobilePurchaseListItem(row, returnSummaries.get(row.id) ?? null))
    .filter((order): order is MobilePurchaseListItem => order != null)
  const parsed = mobilePurchasesSchema.safeParse({ orders })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load orders right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobilePurchaseDetailService(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<MobileApiResult<MobilePurchaseDetail>> {
  const loaded = await getMobilePurchaseDetailRow(supabase, userId, orderId)
  if (!loaded.ok) return { ok: false, status: 500, error: "Unable to load this purchase right now" }
  if (!loaded.rows) return { ok: false, status: 404, error: "Purchase not found" }

  const order = loaded.rows
  const listingId = order.listing_id.trim() || null
  const [trackingDetailRaw, conversation, buyerReview, sellerReview, brandedUrl] = await Promise.all([
    fetchOptionalOrderTrackingDetailJson(supabase, {
      orderId,
      role: "buyer",
      buyerId: userId,
    }),
    getConversationForBuyerSellerListing(supabase, userId, order.seller_id, listingId),
    loadReview(supabase, orderId, userId),
    loadReview(supabase, orderId, order.seller_id),
    order.tracking_number?.trim() ? ensureOrderBrandedTrackingUrl(order.id) : Promise.resolve(null),
  ])
  const detail = buildMobilePurchaseDetail(order, parseOrderTrackingDetail(trackingDetailRaw), {
    conversationId: conversation?.id ?? null,
    buyerReview,
    sellerReview,
    trackUrl: order.tracking_number?.trim()
      ? absoluteTrackUrl(
          packageTrackHref({
            orderId: order.id,
            brandedUrl: brandedUrl,
            trackingNumber: order.tracking_number,
            trackingCarrier: order.tracking_carrier,
          }),
        )
      : null,
  })
  if (!detail) return { ok: false, status: 500, error: "Unable to load this purchase right now" }
  return { ok: true, data: detail }
}

async function loadReview(
  supabase: SupabaseClient,
  orderId: string,
  reviewerId: string,
): Promise<MobilePurchaseReview | null> {
  const { data } = await getMarketplaceReviewByOrderAndReviewer(supabase, orderId, reviewerId)
  return data ? toReview(existingMarketplaceReviewFromRow(data)) : null
}

export function buildMobilePurchaseDetail(
  order: MobilePurchaseDetailRow,
  trackingDetail: ReturnType<typeof parseOrderTrackingDetail>,
  extras: {
    conversationId: string | null
    buyerReview: MobilePurchaseReview | null
    sellerReview: MobilePurchaseReview | null
    trackUrl: string | null
  },
): MobilePurchaseDetail | null {
  const ship = asShippingAddress(order.shipping_address)
  const addressLines = formatAddressLines(ship?.address)
  if (ship?.phone?.trim()) addressLines.push(ship.phone.trim())
  const hasAddress = addressLines.length > 0
  const isPickup =
    order.fulfillment_method === "pickup" ||
    (order.fulfillment_method !== "shipping" && !hasAddress)
  const amounts = splitPurchaseAmount(usd(order.amount), usd(order.shipping_amount))
  const fulfill = isPickup ? "Local pickup" : "Ship to you"
  const sellerName = sellerDisplayName(order.seller_name, order.seller_id)
  const isRefunded = orderStatusIsRefunded(order.status)
  const fulfillmentLocked = orderStatusLocksDuringRefund(order.status)
  const actualDeliveryAt = trackingDetail?.actual_delivery_date ?? order.carrier_delivered_at ?? null
  const statusDisplay = resolveSaleCardStatusDisplay({
    orderStatus: order.status,
    deliveryStatus: order.delivery_status ?? "pending",
    trackingNumber: order.tracking_number,
    trackingDetail,
    fulfillmentMethod: order.fulfillment_method,
    hasShippingAddress: hasAddress,
  })
  const showShippingDeadline =
    !fulfillmentLocked &&
    isEligibleForShippingDeadlineAutoCancel({
      status: order.status,
      fulfillment_method: order.fulfillment_method,
      delivery_status: order.delivery_status ?? "pending",
    })

  const packed = [...order.order_items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const packedLines = packed
    .map((item) => {
      if (!item.listing) return null
      const price = usd(item.item_price)
      return { listing: item.listing, itemPrice: Number.isFinite(Number(item.item_price)) ? price : null }
    })
    .filter((line): line is { listing: MobilePurchaseListing; itemPrice: number | null } => line != null)
  const displayLines =
    packedLines.length > 0
      ? packedLines
      : order.listing
        ? [{ listing: order.listing, itemPrice: null as number | null }]
        : []

  const items =
    displayLines.length > 0
      ? displayLines.map((line) => {
          const single = displayLines.length === 1
          const price = single ? amounts.itemAmount : line.itemPrice
          return {
            id: line.listing.id,
            title: line.listing.title ? capitalizeWords(line.listing.title) : "Item (listing removed)",
            seller_name: sellerName,
            detail_line: purchaseDetailLine(line.listing.condition, fulfill),
            image_url: listingImageUrl(line.listing),
            listing_id: line.listing.id,
            listing_slug: text(line.listing.slug),
            price_usd: price,
            price_label: price != null ? formatUsd(price) : null,
          }
        })
      : [
          {
            id: order.id,
            title: "Item (listing removed)",
            seller_name: sellerName,
            detail_line: fulfill,
            image_url: null,
            listing_id: text(order.listing_id),
            listing_slug: null,
            price_usd: amounts.itemAmount,
            price_label: formatUsd(amounts.itemAmount),
          },
        ]

  const shopListing = displayLines[0]?.listing
  const payload = {
    id: order.id,
    order_number: formatOrderNumForCustomer(order.order_num, order.id),
    items,
    item_amount_usd: amounts.itemAmount,
    item_amount_label: formatUsd(amounts.itemAmount),
    shipping_amount_usd: amounts.shippingAmount,
    shipping_amount_label: formatUsd(amounts.shippingAmount),
    show_shipping: purchaseShowsShipping(fulfill, amounts.shippingAmount),
    total_amount_usd: usd(order.amount),
    total_amount_label: formatUsd(usd(order.amount)),
    amount_struck: isRefunded,
    refund_note: purchaseRefundNote(order.status, usd(order.amount)),
    status_label: statusDisplay.label,
    status_tone: purchaseStatusTone(statusDisplay),
    status_date: purchaseDetailStatusDate({
      deliveryStatus: order.delivery_status ?? "pending",
      orderStatus: order.status,
      createdAt: order.created_at,
      actualDeliveryAt,
      refundedAt: order.refunded_at,
    }),
    shipping_deadline: showShippingDeadline ? getShippingDeadlineDate(order.created_at).toISOString() : null,
    shipping_days_left: showShippingDeadline ? daysUntilShippingDeadline(order.created_at) : null,
    shipping_window_days: SHIPPING_DEADLINE_DAYS,
    timeline_heading: isPickup ? "Pickup details" : "Shipping Details",
    timeline: buildPurchaseDetailTimeline({
      createdAt: order.created_at,
      fulfillmentMethod: isPickup ? "pickup" : "shipping",
      deliveryStatus: order.delivery_status ?? "pending",
      orderStatus: order.status,
      hasTrackingNumber: Boolean(order.tracking_number?.trim()),
      carrierStatusCode: trackingDetail?.status_code,
      events: trackingDetail?.events ?? [],
      actualDeliveryAt,
      refundedAt: order.refunded_at,
    }).map((step) => ({
      id: step.id,
      title: step.title,
      occurred_at: step.occurredAt,
      state: step.state,
    })),
    address_name: text(ship?.name),
    address_lines: addressLines,
    track_url: extras.trackUrl,
    seller_id: order.seller_id,
    seller_name: sellerName,
    seller_handle: text(order.seller_slug),
    seller_avatar_url: absoluteProfileCircleUrl(order.seller_avatar_url),
    listing_id: shopListing?.id ?? text(order.listing_id),
    listing_slug: text(shopListing?.slug),
    conversation_id: extras.conversationId,
    can_review:
      !extras.buyerReview &&
      canSubmitSellerReview(
        { status: order.status, delivery_status: order.delivery_status ?? "pending" },
        trackingDetail,
      ),
    hide_review_prompt: fulfillmentLocked,
    existing_review: extras.buyerReview,
    review_from_seller: extras.sellerReview,
  }
  const parsed = mobilePurchaseDetailSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}
