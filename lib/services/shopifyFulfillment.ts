import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveShopifyConnectionForUser } from "@/lib/db/shopify-connections"
import { getShopifyOrderLink, updateShopifyOrderLink } from "@/lib/db/shopify-order-links"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"
import {
  cancelShopifyOrder,
  createShopifyFulfillmentWithTracking,
} from "@/lib/shopify/admin-api"

export interface ShopifyFulfillmentPushPayload {
  sellerId: string
  connectionId: string
  reswellOrderId: string
  listingId: string
  trackingNumber: string
  trackingCompany?: string | null
  trackingUrl?: string | null
}

/**
 * Enqueue pushing Reswell shipping tracking into the seller's Shopify order. Never throws.
 * Call this after a ShipEngine label is purchased / tracking is known for a Shopify-sourced listing.
 */
export async function pushShopifyFulfillmentBestEffort(
  serviceSupabase: SupabaseClient,
  payload: ShopifyFulfillmentPushPayload,
): Promise<void> {
  try {
    await enqueueShopifySyncJob(serviceSupabase, {
      userId: payload.sellerId,
      connectionId: payload.connectionId,
      jobType: "fulfillment_push",
      dedupeKey: `fulfillment_push:${payload.reswellOrderId}:${payload.listingId}`,
      payload: { ...payload },
    })
  } catch (error) {
    console.error("[shopify] enqueue fulfillment push failed", error)
  }
}

export async function executeShopifyFulfillmentPush(
  serviceSupabase: SupabaseClient,
  payload: ShopifyFulfillmentPushPayload,
): Promise<void> {
  const link = await getShopifyOrderLink(serviceSupabase, payload.reswellOrderId, payload.listingId)
  if (!link?.shopify_order_id) {
    // Order not pushed to Shopify yet — retry later via job backoff.
    throw new Error("Shopify order not yet created for this Reswell order")
  }
  if (link.sync_status === "fulfilled") return

  const connection = await getActiveShopifyConnectionForUser(serviceSupabase, payload.sellerId)
  if (!connection || connection.id !== payload.connectionId) {
    throw new Error("Shopify connection not active for seller")
  }

  const result = await createShopifyFulfillmentWithTracking({
    shopDomain: connection.shop_domain,
    accessToken: connection.access_token,
    orderId: link.shopify_order_id,
    trackingNumber: payload.trackingNumber,
    trackingCompany: payload.trackingCompany ?? null,
    trackingUrl: payload.trackingUrl ?? null,
  })

  await updateShopifyOrderLink(serviceSupabase, link.id, {
    sync_status: "fulfilled",
    shopify_fulfillment_id: result.fulfillmentId ? String(result.fulfillmentId) : null,
    last_error: null,
  })
}

/**
 * After a Reswell label is attached, enqueue fulfillment-tracking pushes for any Shopify-sourced
 * lines in the order. Looks up our own order-link audit table — no order-item schema coupling.
 */
export async function enqueueShopifyFulfillmentForReswellOrder(
  serviceSupabase: SupabaseClient,
  opts: {
    reswellOrderId: string
    trackingNumber: string | null
    trackingCompany?: string | null
    trackingUrl?: string | null
  },
): Promise<void> {
  if (!opts.trackingNumber?.trim()) return
  try {
    const { data: links } = await serviceSupabase
      .from("shopify_order_links")
      .select("user_id, connection_id, listing_id, sync_status")
      .eq("reswell_order_id", opts.reswellOrderId)

    for (const link of links ?? []) {
      if (link.sync_status === "cancelled" || link.sync_status === "refunded") continue
      if (!link.listing_id) continue
      await pushShopifyFulfillmentBestEffort(serviceSupabase, {
        sellerId: link.user_id as string,
        connectionId: link.connection_id as string,
        reswellOrderId: opts.reswellOrderId,
        listingId: link.listing_id as string,
        trackingNumber: opts.trackingNumber.trim(),
        trackingCompany: opts.trackingCompany ?? null,
        trackingUrl: opts.trackingUrl ?? null,
      })
    }
  } catch (error) {
    console.error("[shopify] enqueue fulfillment for order failed", error)
  }
}

export interface ShopifyOrderCancelPayload {
  sellerId: string
  connectionId: string
  reswellOrderId: string
  listingId: string
  reason?: "customer" | "fraud" | "inventory" | "declined" | "other"
}

/** Enqueue cancelling the Shopify order when a Reswell order is refunded/cancelled. */
export async function cancelShopifyOrderBestEffort(
  serviceSupabase: SupabaseClient,
  payload: ShopifyOrderCancelPayload,
): Promise<void> {
  try {
    await enqueueShopifySyncJob(serviceSupabase, {
      userId: payload.sellerId,
      connectionId: payload.connectionId,
      jobType: "order_cancel",
      dedupeKey: `order_cancel:${payload.reswellOrderId}:${payload.listingId}`,
      payload: { ...payload },
    })
  } catch (error) {
    console.error("[shopify] enqueue order cancel failed", error)
  }
}

/**
 * Enqueue cancelling the Shopify order(s) backing a Reswell order — used when a Reswell order
 * is fully refunded/cancelled. Looks up our order-link audit table. Never throws.
 */
export async function enqueueShopifyCancelForReswellOrder(
  serviceSupabase: SupabaseClient,
  reswellOrderId: string,
  reason: ShopifyOrderCancelPayload["reason"] = "customer",
): Promise<void> {
  try {
    const { data: links } = await serviceSupabase
      .from("shopify_order_links")
      .select("user_id, connection_id, listing_id, sync_status, shopify_order_id")
      .eq("reswell_order_id", reswellOrderId)

    for (const link of links ?? []) {
      if (!link.shopify_order_id || !link.listing_id) continue
      if (link.sync_status === "cancelled" || link.sync_status === "refunded") continue
      await cancelShopifyOrderBestEffort(serviceSupabase, {
        sellerId: link.user_id as string,
        connectionId: link.connection_id as string,
        reswellOrderId,
        listingId: link.listing_id as string,
        reason,
      })
    }
  } catch (error) {
    console.error("[shopify] enqueue cancel for order failed", error)
  }
}

export async function executeShopifyOrderCancel(
  serviceSupabase: SupabaseClient,
  payload: ShopifyOrderCancelPayload,
): Promise<void> {
  const link = await getShopifyOrderLink(serviceSupabase, payload.reswellOrderId, payload.listingId)
  if (!link?.shopify_order_id) return
  if (link.sync_status === "cancelled" || link.sync_status === "refunded") return

  const connection = await getActiveShopifyConnectionForUser(serviceSupabase, payload.sellerId)
  if (!connection || connection.id !== payload.connectionId) {
    throw new Error("Shopify connection not active for seller")
  }

  await cancelShopifyOrder({
    shopDomain: connection.shop_domain,
    accessToken: connection.access_token,
    orderId: link.shopify_order_id,
    reason: payload.reason ?? "other",
  })

  await updateShopifyOrderLink(serviceSupabase, link.id, {
    sync_status: "cancelled",
    last_error: null,
  })
}
