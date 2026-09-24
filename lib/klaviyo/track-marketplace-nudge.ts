/**
 * Shared event shape for marketplace nudge emails.
 * Paste `KLAVIYO_MARKETPLACE_NUDGE_EMAIL_HTML` into each flow.
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  absoluteKlaviyoListingImageUrl,
  formatKlaviyoPriceDisplay,
  type KlaviyoListingImage,
} from "@/lib/klaviyo/catalog-product"
import { listingDetailHref } from "@/lib/listing-href"
import {
  COUNTEROFFER_DECLINED_METRIC,
  OFFER_DECLINED_METRIC,
  OFFER_EXPIRING_METRIC,
  PICKUP_REMINDER_METRIC,
  SELLER_SHIP_REMINDER_METRIC,
} from "@/lib/klaviyo/marketplace-metrics"
import { hoursUntil } from "@/lib/klaviyo/marketplace-nudge-windows"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { daysUntilShippingDeadline } from "@/lib/shipping-deadline"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent, type SendKlaviyoServerEventResult } from "@/lib/klaviyo/send-event"

export type MarketplaceNudgeListing = {
  id: string
  title: string
  slug?: string | null
  section?: string | null
  price?: number | null
  images?: KlaviyoListingImage[] | null
}

async function listingImages(listingId: string): Promise<KlaviyoListingImage[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return []
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("listing_images")
      .select("url, thumbnail_url, is_primary, sort_order")
      .eq("listing_id", listingId)
    return (data ?? []) as KlaviyoListingImage[]
  } catch {
    return []
  }
}

function withCampaign(url: string, campaign: string, content: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set("utm_source", "klaviyo")
    parsed.searchParams.set("utm_medium", "email")
    parsed.searchParams.set("utm_campaign", campaign)
    parsed.searchParams.set("utm_content", content)
    return parsed.toString()
  } catch {
    return url
  }
}

function listingUrls(listing: MarketplaceNudgeListing): { listingUrl: string; photoUrl: string } {
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const path = listingDetailHref({
    id: listing.id,
    slug: listing.slug ?? undefined,
    section: listing.section ?? "surfboards",
  })
  const photoUrl = absoluteKlaviyoListingImageUrl({
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price: listing.price,
    section: listing.section,
    listing_images: listing.images ?? [],
  })
  return { listingUrl: `${origin}${path}`, photoUrl }
}

async function sendNudge(input: {
  metricName: string
  uniqueId: string
  profileUserId: string
  email?: string | null
  campaign: string
  headline: string
  bodyLine: string
  title: string
  priceDisplay: string
  listingUrl: string
  photoUrl: string
  ctaLabel: string
  ctaPath: string
  secondaryLabel: string
  secondaryPath: string
  extra?: Record<string, string | number | boolean>
}): Promise<SendKlaviyoServerEventResult> {
  const email =
    input.email !== undefined ? input.email : await getAuthEmailForUserId(input.profileUserId)
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const ctaUrl = withCampaign(`${origin}${input.ctaPath}`, input.campaign, "cta")
  const secondaryUrl = withCampaign(`${origin}${input.secondaryPath}`, input.campaign, "secondary")
  const listingUrl = withCampaign(input.listingUrl, input.campaign, "listing")

  return sendKlaviyoServerEvent({
    metricName: input.metricName,
    uniqueId: input.uniqueId,
    profile: { external_id: input.profileUserId, email },
    properties: {
      headline: input.headline,
      body_line: input.bodyLine,
      Title: input.title,
      price_display: input.priceDisplay,
      photo_url: input.photoUrl,
      listing_url: listingUrl,
      cta_label: input.ctaLabel,
      cta_url: ctaUrl,
      secondary_label: input.secondaryLabel,
      secondary_url: secondaryUrl,
      ...input.extra,
    },
  })
}

export async function trackKlaviyoOfferDeclined(input: {
  offerId: string
  buyerUserId: string
  sellerUserId: string
  offerAmount: number
  listPrice: number
  listing: MarketplaceNudgeListing
  conversationId?: string | null
}): Promise<SendKlaviyoServerEventResult> {
  const images = input.listing.images?.length
    ? input.listing.images
    : await listingImages(input.listing.id)
  const { listingUrl, photoUrl } = listingUrls({ ...input.listing, images })
  const amount = formatKlaviyoPriceDisplay(input.offerAmount)
  const conversationId = input.conversationId?.trim() ?? ""
  const messagesPath = conversationId
    ? `/messages/${conversationId}`
    : `/messages/new?user=${encodeURIComponent(input.sellerUserId)}&listing=${encodeURIComponent(input.listing.id)}`

  return sendNudge({
    metricName: OFFER_DECLINED_METRIC,
    uniqueId: `offer-declined-${input.offerId}`,
    profileUserId: input.buyerUserId,
    campaign: "offer_declined",
    headline: "Your offer was declined",
    bodyLine: `The seller declined your ${amount} offer on “${input.listing.title}”. You can message them or watch the listing.`,
    title: input.listing.title,
    priceDisplay: amount || formatKlaviyoPriceDisplay(input.listPrice),
    listingUrl,
    photoUrl,
    ctaLabel: "View listing",
    ctaPath: listingDetailHref({
      id: input.listing.id,
      slug: input.listing.slug,
      section: input.listing.section ?? "surfboards",
    }),
    secondaryLabel: "Message the seller",
    secondaryPath: messagesPath,
    extra: {
      offer_id: input.offerId,
      audience: "buyer",
      offer_amount: input.offerAmount,
      list_price: input.listPrice,
    },
  })
}

export async function trackKlaviyoCounterofferDeclined(input: {
  offerId: string
  buyerUserId: string
  sellerUserId: string
  offerAmount: number
  listPrice: number
  listing: MarketplaceNudgeListing
  conversationId?: string | null
}): Promise<SendKlaviyoServerEventResult> {
  const images = input.listing.images?.length
    ? input.listing.images
    : await listingImages(input.listing.id)
  const { listingUrl, photoUrl } = listingUrls({ ...input.listing, images })
  const amount = formatKlaviyoPriceDisplay(input.offerAmount)
  const conversationId = input.conversationId?.trim() ?? ""
  const messagesPath = conversationId
    ? `/messages/${conversationId}`
    : `/messages/new?user=${encodeURIComponent(input.buyerUserId)}&listing=${encodeURIComponent(input.listing.id)}`

  return sendNudge({
    metricName: COUNTEROFFER_DECLINED_METRIC,
    uniqueId: `counteroffer-declined-${input.offerId}`,
    profileUserId: input.sellerUserId,
    campaign: "counteroffer_declined",
    headline: "Your counteroffer was declined",
    bodyLine: `The buyer declined your ${amount} counter on “${input.listing.title}”. The listing is still for sale.`,
    title: input.listing.title,
    priceDisplay: formatKlaviyoPriceDisplay(input.listPrice) || amount,
    listingUrl,
    photoUrl,
    ctaLabel: "View offers",
    ctaPath: "/dashboard/offers",
    secondaryLabel: "Message the buyer",
    secondaryPath: messagesPath,
    extra: {
      offer_id: input.offerId,
      audience: "seller",
      offer_amount: input.offerAmount,
      list_price: input.listPrice,
    },
  })
}

export async function trackKlaviyoOfferExpiring(input: {
  offerId: string
  status: "PENDING" | "COUNTERED"
  buyerUserId: string
  sellerUserId: string
  offerAmount: number
  expiresAt: string
  now: Date
  listing: MarketplaceNudgeListing
}): Promise<SendKlaviyoServerEventResult> {
  const { listingUrl, photoUrl } = listingUrls(input.listing)
  const amount = formatKlaviyoPriceDisplay(input.offerAmount)
  const hours = hoursUntil(input.expiresAt, input.now)
  const toSeller = input.status === "PENDING"
  const title = input.listing.title

  return sendNudge({
    metricName: OFFER_EXPIRING_METRIC,
    uniqueId: toSeller
      ? `offer-expiring-seller-${input.offerId}`
      : `offer-expiring-buyer-${input.offerId}`,
    profileUserId: toSeller ? input.sellerUserId : input.buyerUserId,
    campaign: "offer_expiring",
    headline: "This offer expires soon",
    bodyLine: toSeller
      ? `An offer of ${amount} on “${title}” expires in about ${hours} hours. Accept, counter, or decline in Offers.`
      : `The seller’s ${amount} counter on “${title}” expires in about ${hours} hours. Accept or decline before it’s gone.`,
    title,
    priceDisplay: amount,
    listingUrl,
    photoUrl,
    ctaLabel: toSeller ? "Review offer" : "Respond to counter",
    ctaPath: toSeller ? "/dashboard/offers" : "/dashboard/offers?tab=buyer",
    secondaryLabel: "View listing",
    secondaryPath: listingDetailHref({
      id: input.listing.id,
      slug: input.listing.slug,
      section: input.listing.section ?? "surfboards",
    }),
    extra: {
      offer_id: input.offerId,
      audience: toSeller ? "seller" : "buyer",
      offer_status: input.status,
      hours_left: hours,
      offer_amount: input.offerAmount,
    },
  })
}

export async function trackKlaviyoSellerShipReminder(input: {
  orderId: string
  orderNum?: string | null
  sellerUserId: string
  createdAt: string
  now: Date
  amount: number
  listing: MarketplaceNudgeListing
}): Promise<SendKlaviyoServerEventResult> {
  const { listingUrl, photoUrl } = listingUrls(input.listing)
  const daysLeft = daysUntilShippingDeadline(input.createdAt, input.now)
  const orderLabel = formatOrderNumForCustomer(input.orderNum, input.orderId)
  const when =
    daysLeft <= 0
      ? "The ship-by date has passed."
      : `You have about ${daysLeft} day${daysLeft === 1 ? "" : "s"} left in the ship-by window.`

  return sendNudge({
    metricName: SELLER_SHIP_REMINDER_METRIC,
    uniqueId: `seller-ship-reminder-${input.orderId}`,
    profileUserId: input.sellerUserId,
    campaign: "seller_ship_reminder",
    headline: "Time to ship this order",
    bodyLine: `Order ${orderLabel} for “${input.listing.title}” is still unshipped. ${when}`,
    title: input.listing.title,
    priceDisplay: formatKlaviyoPriceDisplay(input.amount),
    listingUrl,
    photoUrl,
    ctaLabel: "Open sale",
    ctaPath: `/dashboard/sales/${input.orderId}`,
    secondaryLabel: "View listing",
    secondaryPath: listingDetailHref({
      id: input.listing.id,
      slug: input.listing.slug,
      section: input.listing.section ?? "surfboards",
    }),
    extra: {
      order_id: input.orderId,
      order_num: orderLabel,
      days_left: daysLeft,
      audience: "seller",
    },
  })
}

export async function trackKlaviyoPickupReminder(input: {
  orderId: string
  orderNum?: string | null
  buyerUserId: string
  pickupCode?: string | null
  amount: number
  listing: MarketplaceNudgeListing
}): Promise<SendKlaviyoServerEventResult> {
  const { listingUrl, photoUrl } = listingUrls(input.listing)
  const orderLabel = formatOrderNumForCustomer(input.orderNum, input.orderId)
  const code = input.pickupCode?.trim() ?? ""
  const codeLine = code ? ` Show pickup code ${code} when you meet.` : ""

  return sendNudge({
    metricName: PICKUP_REMINDER_METRIC,
    uniqueId: `pickup-reminder-${input.orderId}`,
    profileUserId: input.buyerUserId,
    campaign: "pickup_reminder",
    headline: "Your pickup is waiting",
    bodyLine: `Order ${orderLabel} for “${input.listing.title}” is ready for local pickup.${codeLine}`,
    title: input.listing.title,
    priceDisplay: formatKlaviyoPriceDisplay(input.amount),
    listingUrl,
    photoUrl,
    ctaLabel: "View purchase",
    ctaPath: `/dashboard/purchases/${input.orderId}`,
    secondaryLabel: "Message the seller",
    secondaryPath: "/messages",
    extra: {
      order_id: input.orderId,
      order_num: orderLabel,
      pickup_code: code,
      audience: "buyer",
    },
  })
}
