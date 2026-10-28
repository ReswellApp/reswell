import {
  mobileSaleDetailSchema,
  mobileSaleListItemSchema,
  type MobileSaleDetail,
  type MobileSaleListItem,
} from "@reswell/api-contract"
import type { MobileSaleDetailRow, MobileSaleListing, MobileSaleListRow } from "@/lib/db/mobile-sales"
import { listingUsesSantaBarbaraDropoff, listingsUseSantaBarbaraDropoff } from "@/lib/dropoff-santa-barbara"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { resolveMarketplaceOrderBuyerLabel } from "@/lib/order-buyer-display"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import {
  deliveryStatusLabel,
  orderStatusIsRefunded,
  orderStatusLocksDuringRefund,
  payoutStatusLabel,
} from "@/lib/order-status"
import { purchaseDetailStatusDate } from "@/lib/purchase-detail-timeline"
import { purchaseStatusTone } from "@/lib/purchases-list-display"
import { resolveSaleCardStatusDisplay, type OrderReturnSummaryForStatus } from "@/lib/sale-card-status"
import {
  saleIsPendingPickup,
  saleIsPendingShipment,
  saleNeedsFulfillment,
  type SaleFulfillmentFilterInput,
} from "@/lib/sale-fulfillment-filters"
import { saleDetailLine, saleRefundNote } from "@/lib/sales-list-display"
import { resolveSellerOrderDisplayAmounts } from "@/lib/seller-order-display-amounts"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { absolutePublicMediaUrl, absoluteUrl } from "@/lib/site-metadata"
import { formatUsd } from "@/lib/utils/format-usd"

type ShippingAddressJson = {
  name?: string | null
  phone?: string | null
  email?: string | null
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

function listingImageUrl(listing: MobileSaleListing | null): string | null {
  const src = listingTitleThumbnailSrc(listing?.listing_images ?? null)
  return src ? absolutePublicMediaUrl(src) ?? null : null
}

function asShippingAddress(value: unknown): ShippingAddressJson {
  if (!value || typeof value !== "object") return null
  return value as ShippingAddressJson
}

function formatAddressBlock(addr: NonNullable<ShippingAddressJson>["address"]): string | null {
  if (!addr) return null
  const parts = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter((part) => part && String(part).trim())
  return parts.length ? parts.join("\n") : null
}

function hasShippingAddress(ship: ShippingAddressJson): boolean {
  return Boolean(formatAddressBlock(ship?.address))
}

function fulfillmentLabel(method: string | null, hasShipAddr: boolean): string {
  if (method === "shipping" || hasShipAddr) return "Ship to buyer"
  if (method === "pickup") return "Local pickup"
  return hasShipAddr ? "Ship to buyer" : "Local pickup"
}

export function saleUsesSantaBarbaraDropoff(row: {
  listing: MobileSaleListing | null
  order_item_listings: MobileSaleListing[]
}): boolean {
  return listingsUseSantaBarbaraDropoff([row.listing, ...row.order_item_listings])
}

export function absoluteTrackUrl(href: string | null): string | null {
  if (!href) return null
  if (/^https?:\/\//i.test(href)) return href
  return absoluteUrl(href)
}

export function filterInputForRow(
  row: MobileSaleListRow,
  prepared: boolean,
): SaleFulfillmentFilterInput {
  const santaBarbara = saleUsesSantaBarbaraDropoff(row)
  return {
    fulfillmentMethod: row.fulfillment_method,
    deliveryStatus: row.delivery_status ?? "pending",
    orderStatus: row.status,
    hasShippingAddress: hasShippingAddress(asShippingAddress(row.shipping_address)),
    hasPreparedShippingLabel: prepared && !santaBarbara,
  }
}

function pendingKind(input: SaleFulfillmentFilterInput): "shipment" | "pickup" | null {
  if (saleIsPendingShipment(input)) return "shipment"
  if (saleIsPendingPickup(input)) return "pickup"
  return null
}

export function toMobileSaleListItem(
  row: MobileSaleListRow,
  extras: {
    preparedLabel: boolean
    returnSummary: OrderReturnSummaryForStatus | null
  },
): MobileSaleListItem | null {
  const listing = row.listing
  const title = listing?.title ? capitalizeWords(listing.title) : "Item (listing removed)"
  const ship = asShippingAddress(row.shipping_address)
  const hasAddr = hasShippingAddress(ship)
  const fulfill = fulfillmentLabel(row.fulfillment_method, hasAddr)
  const santaBarbara = saleUsesSantaBarbaraDropoff(row)
  const amounts = resolveSellerOrderDisplayAmounts({
    amount: row.amount ?? 0,
    shipping_amount: row.shipping_amount,
    platform_fee: row.platform_fee,
    seller_earnings: row.seller_earnings ?? 0,
    promo_discount_usd: row.promo_discount_usd,
  })
  const input = filterInputForRow(row, extras.preparedLabel)
  const trackingDetail = parseOrderTrackingDetail(row.tracking_detail)
  const statusDisplay = resolveSaleCardStatusDisplay({
    orderStatus: row.status,
    deliveryStatus: row.delivery_status ?? "pending",
    trackingNumber: row.tracking_number,
    trackingDetail,
    hasPreparedShippingLabel: input.hasPreparedShippingLabel,
    returnSummary: extras.returnSummary,
    fulfillmentMethod: row.fulfillment_method,
    hasShippingAddress: hasAddr,
  })
  const buyerName = resolveMarketplaceOrderBuyerLabel({
    buyerId: row.buyer_id,
    profileDisplayName: row.buyer_name,
    shippingAddress: ship,
  })
  const item: MobileSaleListItem = {
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
    listing_image_url: listingImageUrl(listing),
    counterparty_name: buyerName,
    seller_earnings_usd: amounts.sellerEarningsAmount,
    seller_earnings_label: formatUsd(amounts.sellerEarningsAmount),
    buyer_name: buyerName,
    detail_line: saleDetailLine(listing?.condition, fulfill, santaBarbara),
    primary_suffix: "earnings",
    shipping_amount_usd: amounts.shippingAmount,
    shipping_amount_label: formatUsd(amounts.shippingAmount),
    show_shipping: amounts.shippingAmount > 0,
    amount_struck: orderStatusIsRefunded(row.status),
    refund_note: saleRefundNote(row.status, amounts.buyerPaidTotal),
    status_tone: purchaseStatusTone(statusDisplay),
    needs_fulfillment: saleNeedsFulfillment(input),
    pending_kind: pendingKind(input),
  }
  const parsed = mobileSaleListItemSchema.safeParse(item)
  return parsed.success ? parsed.data : null
}

export function buildMobileSaleDetail(
  order: MobileSaleDetailRow,
  extras: {
    conversationId: string | null
    labelAvailable: boolean
    trackUrl: string | null
    preparedLabel: boolean
    returnSummary: OrderReturnSummaryForStatus | null
  },
): MobileSaleDetail | null {
  const ship = asShippingAddress(order.shipping_address)
  const addrBlock = formatAddressBlock(ship?.address)
  const hasAddr = Boolean(addrBlock)
  const fulfill = fulfillmentLabel(order.fulfillment_method, hasAddr)
  const santaBarbara = saleUsesSantaBarbaraDropoff(order)
  const amounts = resolveSellerOrderDisplayAmounts({
    amount: order.amount ?? 0,
    shipping_amount: order.shipping_amount,
    platform_fee: order.platform_fee,
    seller_earnings: order.seller_earnings ?? 0,
    promo_discount_usd: order.promo_discount_usd,
  })
  const isPickup = order.fulfillment_method === "pickup"
  const isRefunded = orderStatusIsRefunded(order.status)
  const isRefunding = order.status === "refunding"
  const fulfillmentLocked = orderStatusLocksDuringRefund(order.status)
  const trackingDetail = parseOrderTrackingDetail(order.tracking_detail)
  const statusDisplay = resolveSaleCardStatusDisplay({
    orderStatus: order.status,
    deliveryStatus: order.delivery_status ?? "pending",
    trackingNumber: order.tracking_number,
    trackingDetail,
    hasPreparedShippingLabel: extras.preparedLabel && !santaBarbara,
    returnSummary: extras.returnSummary,
    fulfillmentMethod: order.fulfillment_method,
    hasShippingAddress: hasAddr,
  })
  const buyerName = resolveMarketplaceOrderBuyerLabel({
    buyerId: order.buyer_id,
    profileDisplayName: order.buyer_name,
    shippingAddress: ship,
  })
  const packed = [...order.order_items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const packedLines = packed
    .map((item) => (item.listing ? { listing: item.listing, itemPrice: usd(item.item_price) } : null))
    .filter((line): line is { listing: MobileSaleListing; itemPrice: number } => line != null)
  const displayLines =
    packedLines.length > 0
      ? packedLines
      : order.listing
        ? [{ listing: order.listing, itemPrice: amounts.itemPriceAmount }]
        : []
  const items =
    displayLines.length > 0
      ? displayLines.map((line) => {
          const single = displayLines.length === 1
          const price = single ? amounts.itemPriceAmount : line.itemPrice
          return {
            id: line.listing.id,
            title: line.listing.title ? capitalizeWords(line.listing.title) : "Item (listing removed)",
            buyer_name: buyerName,
            detail_line: saleDetailLine(
              line.listing.condition,
              fulfill,
              listingUsesSantaBarbaraDropoff(line.listing),
            ),
            image_url: listingImageUrl(line.listing),
            listing_id: line.listing.id,
            listing_slug: text(line.listing.slug),
            price_usd: price,
            price_label: formatUsd(price),
          }
        })
      : [
          {
            id: order.id,
            title: "Item (listing removed)",
            buyer_name: buyerName,
            detail_line: fulfill,
            image_url: null,
            listing_id: text(order.listing_id),
            listing_slug: null,
            price_usd: amounts.itemPriceAmount,
            price_label: formatUsd(amounts.itemPriceAmount),
          },
        ]

  const refundNote = saleRefundNote(order.status, amounts.buyerPaidTotal)
  const earningsRefundNote =
    isRefunded && refundNote
      ? `${refundNote} Your earnings were reversed after the platform fee.`
      : refundNote
  const created = new Date(order.created_at)
  const hasTracking = Boolean(order.tracking_number?.trim())
  const payload = {
    id: order.id,
    order_number: formatOrderNumForCustomer(order.order_num, order.id),
    status: order.status,
    status_label: statusDisplay.label,
    delivery_status: text(order.delivery_status),
    amount_usd: usd(order.amount),
    amount_label: formatUsd(usd(order.amount)),
    fulfillment_label: fulfill,
    created_at: order.created_at,
    tracking_number: text(order.tracking_number),
    listing_id: order.listing?.id ?? text(order.listing_id),
    listing_title: items[0]?.title ?? "Item (listing removed)",
    listing_image_url: items[0]?.image_url ?? null,
    counterparty_name: buyerName,
    seller_earnings_usd: amounts.sellerEarningsAmount,
    seller_earnings_label: formatUsd(amounts.sellerEarningsAmount),
    created_label: Number.isNaN(created.getTime())
      ? ""
      : created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    buyer_paid_label: formatUsd(amounts.buyerPaidTotal),
    shipping_label: formatUsd(amounts.shippingAmount),
    fee_label: formatUsd(amounts.platformFee),
    ship_to: addrBlock,
    tracking_carrier: text(order.tracking_carrier),
    payout_status: text(order.payout_status),
    conversation_id: extras.conversationId,
    listing_slug: order.listing_slug,
    label_available: extras.labelAvailable,
    items,
    item_amount_usd: amounts.itemPriceAmount,
    item_amount_label: formatUsd(amounts.itemPriceAmount),
    shipping_amount_usd: amounts.shippingAmount,
    show_shipping: amounts.shippingAmount > 0,
    platform_fee_usd: amounts.platformFee,
    platform_fee_label: `-${formatUsd(amounts.platformFee)}`,
    show_platform_fee: amounts.platformFee > 0,
    payment_label: order.stripe_checkout_session_id ? "Card" : "Wallet",
    amount_struck: isRefunded,
    refund_note: earningsRefundNote,
    promo_note:
      amounts.hadReswellPromo && !isRefunded && !isRefunding
        ? "The buyer used a Reswell promo code. Your earnings use the full listing price. Reswell covers the discount."
        : null,
    shipping_note:
      amounts.shippingAmount > 0 && !isRefunded && !isRefunding
        ? "Shipping is paid by the buyer for the carrier label and is not part of your earnings."
        : null,
    status_tone: purchaseStatusTone(statusDisplay),
    status_date: purchaseDetailStatusDate({
      deliveryStatus: order.delivery_status ?? "pending",
      orderStatus: order.status,
      createdAt: order.created_at,
      actualDeliveryAt: trackingDetail?.actual_delivery_date ?? null,
      refundedAt: order.refunded_at,
    }),
    address_name: text(ship?.name),
    address_lines: addrBlock ? addrBlock.split("\n").filter((line) => line.trim().length > 0) : [],
    track_url: extras.trackUrl,
    buyer_id: order.buyer_id,
    buyer_name: buyerName,
    is_pickup: isPickup,
    can_verify_pickup: isPickup && !fulfillmentLocked && order.delivery_status !== "picked_up",
    fulfillment_locked: fulfillmentLocked,
    delivery_badge_label: !hasTracking || isPickup ? deliveryStatusLabel(order.delivery_status ?? "pending") : null,
    payout_badge_label: order.payout_status
      ? payoutStatusLabel(order.payout_status, order.payout_hold_reason)
      : null,
    can_request_support: order.status === "confirmed",
  }
  const parsed = mobileSaleDetailSchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}
