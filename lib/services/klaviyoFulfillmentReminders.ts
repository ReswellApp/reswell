import type { SupabaseClient } from "@supabase/supabase-js"

import type { KlaviyoListingImage } from "@/lib/klaviyo/catalog-product"
import { findSentKlaviyoUniqueIds } from "@/lib/db/klaviyoEventLog"
import {
  FULFILLMENT_REMINDER_AFTER_MS,
  FULFILLMENT_REMINDER_MAX_AGE_MS,
  orderIsInFulfillmentReminderWindow,
} from "@/lib/klaviyo/marketplace-nudge-windows"
import {
  trackKlaviyoPickupReminder,
  trackKlaviyoSellerShipReminder,
} from "@/lib/klaviyo/track-marketplace-nudge"

const BATCH_LIMIT = 200

export type FulfillmentReminderSummary = {
  eligible: number
  emitted: number
  skipped: number
  failed: number
}

type ListingEmbed = {
  id: string
  title: string | null
  slug: string | null
  section: string | null
  price: number | string | null
  listing_images: KlaviyoListingImage[] | null
}

type OrderRow = {
  id: string
  order_num: string | null
  seller_id: string
  buyer_id: string
  created_at: string
  amount: number | string | null
  fulfillment_method: string | null
  delivery_status: string | null
  pickup_code: string | null
  listings: ListingEmbed | ListingEmbed[] | null
}

function oneListing(value: OrderRow["listings"]): ListingEmbed | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function reminderKey(order: OrderRow): string | null {
  if (
    order.fulfillment_method === "shipping" &&
    order.delivery_status === "pending"
  ) {
    return `seller-ship-reminder-${order.id}`
  }
  if (
    order.fulfillment_method === "pickup" &&
    (order.delivery_status === "pending" || order.delivery_status === "pickup_ready")
  ) {
    return `pickup-reminder-${order.id}`
  }
  return null
}

/**
 * One reminder per open order: sellers who have not shipped after 48 hours,
 * and buyers who have not picked up after 48 hours.
 */
export async function processKlaviyoFulfillmentReminders(
  supabase: SupabaseClient,
  referenceTime: Date,
): Promise<FulfillmentReminderSummary> {
  const summary: FulfillmentReminderSummary = {
    eligible: 0,
    emitted: 0,
    skipped: 0,
    failed: 0,
  }

  const newest = new Date(referenceTime.getTime() - FULFILLMENT_REMINDER_AFTER_MS).toISOString()
  const oldest = new Date(referenceTime.getTime() - FULFILLMENT_REMINDER_MAX_AGE_MS).toISOString()

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id, order_num, seller_id, buyer_id, created_at, amount,
      fulfillment_method, delivery_status, pickup_code,
      listings ( id, title, slug, section, price, listing_images (url, thumbnail_url, is_primary, sort_order) )
    `,
    )
    .eq("status", "confirmed")
    .eq("is_admin_test", false)
    .in("fulfillment_method", ["shipping", "pickup"])
    .in("delivery_status", ["pending", "pickup_ready"])
    .lte("created_at", newest)
    .gte("created_at", oldest)
    .limit(BATCH_LIMIT)

  if (error) {
    console.error("[klaviyoFulfillmentReminders] select:", error.message)
    throw new Error(error.message)
  }

  const rows = ((data ?? []) as OrderRow[]).filter((row) =>
    orderIsInFulfillmentReminderWindow(row.created_at, referenceTime),
  )
  const keys = rows
    .map((row) => reminderKey(row))
    .filter((id): id is string => Boolean(id))
  const alreadySent = await findSentKlaviyoUniqueIds(keys)

  for (const row of rows) {
    const key = reminderKey(row)
    const listing = oneListing(row.listings)
    if (!key || !listing) {
      summary.skipped += 1
      continue
    }
    if (alreadySent.has(key)) {
      summary.skipped += 1
      continue
    }

    summary.eligible += 1
    const amount = Number(row.amount)
    const listingPayload = {
      id: listing.id,
      title: listing.title?.trim() || "your order",
      slug: listing.slug,
      section: listing.section,
      price: Number(listing.price),
      images: listing.listing_images,
    }

    const result =
      row.fulfillment_method === "pickup"
        ? await trackKlaviyoPickupReminder({
            orderId: row.id,
            orderNum: row.order_num,
            buyerUserId: row.buyer_id,
            pickupCode: row.pickup_code,
            amount: Number.isFinite(amount) ? amount : 0,
            listing: listingPayload,
          })
        : await trackKlaviyoSellerShipReminder({
            orderId: row.id,
            orderNum: row.order_num,
            sellerUserId: row.seller_id,
            createdAt: row.created_at,
            now: referenceTime,
            amount: Number.isFinite(amount) ? amount : 0,
            listing: listingPayload,
          })

    if (result.ok) summary.emitted += 1
    else if (result.skipped) summary.skipped += 1
    else summary.failed += 1
  }

  return summary
}
