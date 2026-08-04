/**
 * Server-only: Klaviyo Events API — fires when a marketplace order is fully refunded
 * (admin Issue refund button / sync when the order becomes `refunded` in-app).
 *
 * **Metric name in Klaviyo:** `Order Refunded`
 *
 * Emits **twice** for the same order — once for the **buyer** profile and once for the
 * **seller** profile — so one metric can drive both emails. Differentiate with:
 *   `recipient_role` = `buyer` | `seller`
 *
 * **Flow setup:** Flows → Metric → **Order Refunded**
 * - Buyer email: filter `recipient_role` equals `buyer`
 * - Seller email: filter `recipient_role` equals `seller`
 *
 * Paste HTML from `lib/klaviyo/order-refunded-email-liquid.ts`.
 *
 * Template variables (shared): `order_num`, `Title`, `amount_display`, `Items[]`,
 * `listing_image_url`, `listing_brand`, `listing_board_type`, `listing_condition`,
 * `listing_section_label`, `listing_location`, `listing_dimensions`, `listing_url`,
 * `payment_method`, `fulfillment_method`, `refund_type`, `buyer_display_name`,
 * `seller_display_name`, `recipient_role`, `order_url`.
 */

import { formatKlaviyoPriceDisplay } from "@/lib/klaviyo/catalog-product"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  isPeerListingSection,
  PEER_LISTING_SECTION_LABELS,
} from "@/lib/peer-listing-sections"

export type KlaviyoOrderRefundedRecipientRole = "buyer" | "seller"

export type KlaviyoOrderRefundedLineItem = {
  listingId: string
  listingTitle: string
  listingSection?: string | null
  listingSlug?: string | null
  listingImageUrl?: string | null
  price: number
  quantity?: number
  brand?: string | null
  boardType?: string | null
  condition?: string | null
  city?: string | null
  state?: string | null
  dimensions?: string | null
}

export type KlaviyoOrderRefundedPayload = {
  recipientRole: KlaviyoOrderRefundedRecipientRole
  buyerUserId: string
  buyerEmail: string | null
  buyerDisplayName: string
  sellerUserId: string
  sellerEmail: string | null
  sellerDisplayName: string
  orderId: string
  orderNum?: string | null
  listingId?: string | null
  listingTitle: string
  listingSection?: string | null
  listingSlug?: string | null
  listingImageUrl?: string | null
  listingBrand?: string | null
  listingBoardType?: string | null
  listingCondition?: string | null
  listingCity?: string | null
  listingState?: string | null
  listingDimensions?: string | null
  /** Buyer-paid order total (USD). */
  amount: number
  /** Seller net earnings reversed (USD), when known. */
  sellerEarnings?: number | null
  paymentMethod: string | null
  fulfillmentMethod?: string | null
  refundType: "stripe" | "wallet"
  refundedAt?: string | null
  /** How the refund was completed in Reswell (e.g. admin). */
  source?: string | null
  lineItems?: KlaviyoOrderRefundedLineItem[]
}

type RefundCommerceItem = {
  ProductID: string
  ProductName: string
  Quantity: number
  ItemPrice: number
  RowTotal: number
  ProductURL: string
  ImageURL: string
  Brand: string
  BoardType: string
  Condition: string
  Location: string
  Dimensions: string
  SectionLabel: string
}

function sectionLabel(section: string | null | undefined): string {
  const s = section?.trim() ?? ""
  if (!s) return ""
  return isPeerListingSection(s) ? PEER_LISTING_SECTION_LABELS[s] : s
}

function locationLabel(city: string | null | undefined, state: string | null | undefined): string {
  const c = city?.trim() ?? ""
  const st = state?.trim() ?? ""
  if (c && st) return `${c}, ${st}`
  return c || st
}

function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "stripe":
      return "Card"
    case "reswell_bucks":
      return "Reswell wallet"
    case "cash":
      return "Cash"
    default:
      return method?.trim() || ""
  }
}

function fulfillmentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "shipping":
      return "Shipping"
    case "pickup":
      return "Local pickup"
    default:
      return method?.trim() || ""
  }
}

function refundDestinationLabel(refundType: "stripe" | "wallet"): string {
  return refundType === "wallet" ? "your Reswell wallet" : "your original payment method"
}

function toCommerceItems(
  payload: KlaviyoOrderRefundedPayload,
  origin: string,
): RefundCommerceItem[] {
  const lines =
    payload.lineItems && payload.lineItems.length > 0
      ? payload.lineItems
      : [
          {
            listingId: payload.listingId ?? "",
            listingTitle: payload.listingTitle,
            listingSection: payload.listingSection,
            listingSlug: payload.listingSlug,
            listingImageUrl: payload.listingImageUrl,
            price: payload.amount,
            quantity: 1,
            brand: payload.listingBrand,
            boardType: payload.listingBoardType,
            condition: payload.listingCondition,
            city: payload.listingCity,
            state: payload.listingState,
            dimensions: payload.listingDimensions,
          } satisfies KlaviyoOrderRefundedLineItem,
        ]

  return lines
    .filter((line) => line.listingId.trim() || line.listingTitle.trim())
    .map((line) => {
      const qty = Math.max(1, line.quantity ?? 1)
      const price = Number.isFinite(line.price) ? line.price : 0
      const listingPath = line.listingId.trim()
        ? listingDetailHref({
            id: line.listingId.trim(),
            slug: line.listingSlug ?? undefined,
            section: line.listingSection ?? undefined,
          })
        : ""
      return {
        ProductID: line.listingId.trim() || payload.orderId,
        ProductName: line.listingTitle.trim() || "Listing",
        Quantity: qty,
        ItemPrice: price,
        RowTotal: Math.round(price * qty * 100) / 100,
        ProductURL: listingPath ? `${origin}${listingPath}` : "",
        ImageURL: line.listingImageUrl?.trim() ?? "",
        Brand: line.brand?.trim() ?? "",
        BoardType: line.boardType?.trim() ?? "",
        Condition: line.condition?.trim() ?? "",
        Location: locationLabel(line.city, line.state),
        Dimensions: line.dimensions?.trim() ?? "",
        SectionLabel: sectionLabel(line.listingSection),
      }
    })
}

/**
 * Emit **Order Refunded** for one recipient (buyer or seller).
 * Call twice from the emit service — once per role.
 */
export async function trackKlaviyoOrderRefunded(
  payload: KlaviyoOrderRefundedPayload,
): Promise<void> {
  const origin = publicSiteOrigin()
  const isBuyer = payload.recipientRole === "buyer"
  const orderUrl = isBuyer
    ? `${origin}/dashboard/purchases/${payload.orderId}`
    : `${origin}/dashboard/sales/${payload.orderId}`
  const listingUrl = payload.listingId?.trim()
    ? `${origin}${listingDetailHref({
        id: payload.listingId.trim(),
        slug: payload.listingSlug ?? undefined,
        section: payload.listingSection ?? undefined,
      })}`
    : ""

  const amountNum =
    typeof payload.amount === "number" ? payload.amount : Number(payload.amount)
  const sellerEarningsNum =
    payload.sellerEarnings == null
      ? null
      : typeof payload.sellerEarnings === "number"
        ? payload.sellerEarnings
        : Number(payload.sellerEarnings)

  const items = toCommerceItems(payload, origin)

  const profile = isBuyer
    ? { external_id: payload.buyerUserId, email: payload.buyerEmail }
    : { external_id: payload.sellerUserId, email: payload.sellerEmail }

  const value = isBuyer
    ? Number.isFinite(amountNum)
      ? amountNum
      : undefined
    : sellerEarningsNum != null && Number.isFinite(sellerEarningsNum)
      ? sellerEarningsNum
      : Number.isFinite(amountNum)
        ? amountNum
        : undefined

  await sendKlaviyoServerEvent({
    metricName: "Order Refunded",
    profile,
    uniqueId: `order-refunded-${payload.orderId}-${payload.recipientRole}`,
    value,
    valueCurrency: "USD",
    properties: {
      ProductID: payload.listingId?.trim() || payload.orderId,
      Items: items,
      recipient_role: payload.recipientRole,
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId ?? "",
      Title: payload.listingTitle,
      listing_image_url: payload.listingImageUrl?.trim() ?? "",
      listing_brand: payload.listingBrand?.trim() ?? "",
      listing_board_type: payload.listingBoardType?.trim() ?? "",
      listing_condition: payload.listingCondition?.trim() ?? "",
      listing_section: payload.listingSection?.trim() ?? "",
      listing_section_label: sectionLabel(payload.listingSection),
      listing_city: payload.listingCity?.trim() ?? "",
      listing_state: payload.listingState?.trim() ?? "",
      listing_location: locationLabel(payload.listingCity, payload.listingState),
      listing_dimensions: payload.listingDimensions?.trim() ?? "",
      amount: Number.isFinite(amountNum) ? amountNum : 0,
      amount_display: formatKlaviyoPriceDisplay(
        Number.isFinite(amountNum) ? amountNum : null,
      ),
      seller_earnings:
        sellerEarningsNum != null && Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : 0,
      seller_earnings_display: formatKlaviyoPriceDisplay(
        sellerEarningsNum != null && Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : null,
      ),
      payment_method: payload.paymentMethod ?? "",
      payment_method_label: paymentMethodLabel(payload.paymentMethod),
      fulfillment_method: payload.fulfillmentMethod ?? "",
      fulfillment_method_label: fulfillmentMethodLabel(payload.fulfillmentMethod),
      refund_type: payload.refundType,
      refund_destination: refundDestinationLabel(payload.refundType),
      refunded_at: payload.refundedAt ?? "",
      source: payload.source ?? "admin",
      order_url: orderUrl,
      listing_url: listingUrl,
      buyer_user_id: payload.buyerUserId,
      buyer_display_name: payload.buyerDisplayName,
      seller_user_id: payload.sellerUserId,
      seller_display_name: payload.sellerDisplayName,
      dashboard_cta_label: isBuyer ? "View purchase" : "View sale",
    },
  })
}
