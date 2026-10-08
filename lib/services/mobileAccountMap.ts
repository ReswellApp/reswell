import {
  mobileConversationPreviewSchema,
  mobileOfferSchema,
  mobileOrderSchema,
  mobileReviewSchema,
  mobileSaleSchema,
  type MobileConversationPreview,
  type MobileOffer,
  type MobileOrder,
  type MobileReview,
  type MobileSale,
} from "@reswell/api-contract"
import type { MobileOrderRow, MobileReviewRow } from "@/lib/db/mobile-account"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import { getPublicSellerDisplayName } from "@/lib/listing-labels"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import { redactShippingLabelArtifactsFromMessage } from "@/lib/messages/redact-seller-shipping-label"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { orderStatusLabel } from "@/lib/order-status"
import { absoluteProxiedProfileMediaUrl } from "@/lib/public-media-display-src"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import type { DashboardOfferRow, DashboardProfileLite } from "@/lib/types/offers-dashboard"
import type { InboxConversationRow } from "@/lib/utils/messages-inbox-grouping"

function usd(value: number | string | null | undefined): number {
  if (value == null) return 0
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100) / 100
}

function moneyLabel(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function imageUrl(images: ListingImageForCard[] | null | undefined): string | null {
  const src = listingCardImageSrc(images)
  return src ? absolutePublicMediaUrl(src) ?? null : null
}

export function toMobileReview(row: MobileReviewRow, profileId: string): MobileReview | null {
  const rating = Math.round(Number(row.rating))
  const review = {
    id: row.id,
    rating,
    comment: text(row.comment),
    created_at: row.created_at,
    reviewer_name: getPublicSellerDisplayName({ display_name: row.reviewer_name }),
    role: row.listing_seller_id === profileId ? "seller" : "buyer",
  }
  const parsed = mobileReviewSchema.safeParse(review)
  return parsed.success ? parsed.data : null
}

export function toMobileOffer(
  row: DashboardOfferRow,
  role: "sent" | "received",
  counterparty: DashboardProfileLite | undefined,
): MobileOffer | null {
  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings
  const amount = usd(row.current_amount)
  const offer = {
    id: row.id,
    status: row.status,
    role,
    amount_usd: amount,
    amount_label: moneyLabel(amount),
    expires_at: row.expires_at,
    note: text(role === "received" ? row.buyer_note : row.seller_counter_note),
    listing_id: listing?.id ?? row.listing_id,
    listing_title: text(listing?.title) ?? "Listing",
    listing_image_url: imageUrl(listing?.listing_images ?? null),
    counterparty_name: getPublicSellerDisplayName(counterparty),
  }
  const parsed = mobileOfferSchema.safeParse(offer)
  return parsed.success ? parsed.data : null
}

export function toMobileOrder(row: MobileOrderRow): MobileOrder | null {
  const amount = usd(row.amount)
  const order = {
    id: row.id,
    order_number: formatOrderNumForCustomer(row.order_num, row.id),
    status: row.status,
    status_label: orderStatusLabel(row.status),
    delivery_status: text(row.delivery_status),
    amount_usd: amount,
    amount_label: moneyLabel(amount),
    fulfillment_label: row.fulfillment_method === "shipping" ? "Ship to you" : "Local pickup",
    created_at: row.created_at,
    tracking_number: text(row.tracking_number),
    listing_id: row.listing?.id ?? null,
    listing_title: text(row.listing?.title) ?? "Listing",
    listing_image_url: imageUrl(row.listing?.listing_images ?? null),
    counterparty_name: getPublicSellerDisplayName({ display_name: row.counterparty_name }),
  }
  const parsed = mobileOrderSchema.safeParse(order)
  return parsed.success ? parsed.data : null
}

export function toMobileSale(row: MobileOrderRow): MobileSale | null {
  const order = toMobileOrder(row)
  if (!order) return null
  const earnings = usd(row.seller_earnings)
  const parsed = mobileSaleSchema.safeParse({
    ...order,
    fulfillment_label: row.fulfillment_method === "pickup" ? "Local pickup" : "Shipping",
    seller_earnings_usd: earnings,
    seller_earnings_label: moneyLabel(earnings),
  })
  return parsed.success ? parsed.data : null
}

export function toMobileConversationPreview(
  row: InboxConversationRow,
  userId: string,
): MobileConversationPreview | null {
  const other = row.buyer_id === userId ? row.seller : row.buyer
  const latest = [...row.messages].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
  const unread = row.messages.filter((message) => !message.is_read && message.sender_id !== userId).length
  const preview = latest
    ? text(String(redactShippingLabelArtifactsFromMessage(latest).content ?? ""))
    : null
  const avatar = text(other?.avatar_url)
  const parsed = mobileConversationPreviewSchema.safeParse({
    id: row.id,
    listing_id: row.listing_id,
    listing_title: text(row.listing?.title),
    other_name: getPublicSellerDisplayName(other),
    other_avatar_url: avatar ? absoluteProxiedProfileMediaUrl(avatar) ?? null : null,
    preview,
    last_message_at: row.last_message_at,
    unread_count: unread,
  })
  return parsed.success ? parsed.data : null
}
