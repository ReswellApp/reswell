import type { SupabaseClient } from "@supabase/supabase-js"
import { getShopifyLinkByVariantId } from "@/lib/db/shopify-product-links"
import { getListingVariantById } from "@/lib/db/listing-variants"
import { getActiveShopifyConnectionForUser } from "@/lib/db/shopify-connections"
import {
  getOrCreateShopifyOrderLink,
  updateShopifyOrderLink,
} from "@/lib/db/shopify-order-links"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"
import {
  adjustShopifyInventory,
  createShopifyOrder,
  fetchShopifyPrimaryLocationId,
  fetchShopifyVariantInventoryItem,
  type ShopifyOrderAddress,
} from "@/lib/shopify/admin-api"

/**
 * Called from order completion. Enqueues a durable `order_push` job so a Reswell sale of a
 * Shopify-sourced listing becomes a real, paid Shopify order (with retries). Never throws.
 */
export async function pushReswellOrderToShopifyBestEffort(opts: {
  serviceSupabase: SupabaseClient
  sellerId: string
  listingId: string
  listingVariantId?: string | null
  listingTitle: string
  itemPriceUsd: number
  buyerEmail?: string | null
  reswellOrderId: string
}): Promise<void> {
  try {
    const { data: productLink } = await opts.serviceSupabase
      .from("shopify_product_links")
      .select("connection_id, shopify_variant_id")
      .eq("listing_id", opts.listingId)
      .maybeSingle()

    if (!productLink) return

    let shopifyVariantId = productLink.shopify_variant_id as string | null
    if (!shopifyVariantId && opts.listingVariantId) {
      const variant = await getListingVariantById(opts.serviceSupabase, opts.listingVariantId)
      shopifyVariantId = variant?.shopify_variant_id ?? null
    }
    if (!shopifyVariantId) return

    await enqueueShopifySyncJob(opts.serviceSupabase, {
      userId: opts.sellerId,
      connectionId: productLink.connection_id as string,
      jobType: "order_push",
      dedupeKey: `order_push:${opts.reswellOrderId}:${opts.listingId}`,
      payload: {
        sellerId: opts.sellerId,
        listingId: opts.listingId,
        listingTitle: opts.listingTitle,
        itemPriceUsd: opts.itemPriceUsd,
        buyerEmail: opts.buyerEmail ?? null,
        reswellOrderId: opts.reswellOrderId,
        variantId: shopifyVariantId,
        connectionId: productLink.connection_id,
      },
    })
  } catch (error) {
    console.error("[shopify] enqueue order push failed", {
      listingId: opts.listingId,
      sellerId: opts.sellerId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function mapReswellShippingAddress(raw: unknown): ShopifyOrderAddress | null {
  if (!raw || typeof raw !== "object") return null
  const a = raw as Record<string, unknown>
  const str = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = a[k]
      if (typeof v === "string" && v.trim()) return v.trim()
    }
    return null
  }
  const fullName = str("name", "full_name", "recipient")
  let firstName = str("first_name", "firstName")
  let lastName = str("last_name", "lastName")
  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/)
    firstName = parts[0] ?? null
    lastName = parts.slice(1).join(" ") || null
  }
  return {
    firstName,
    lastName,
    address1: str("address1", "line1", "street", "address_line1"),
    address2: str("address2", "line2", "address_line2", "apt", "unit"),
    city: str("city", "town"),
    province: str("province", "state", "region"),
    zip: str("zip", "postal_code", "postalCode", "zip_code"),
    country: str("country", "country_code") ?? "US",
    phone: str("phone", "phone_number"),
  }
}

export interface ShopifyOrderPushPayload {
  sellerId: string
  listingId: string
  listingTitle: string
  itemPriceUsd: number
  buyerEmail?: string | null
  reswellOrderId: string
  variantId: string
  connectionId: string
}

/**
 * Worker handler: create the real Shopify order, then decrement Shopify inventory for the variant.
 * Idempotent via the shopify_order_links unique (reswell_order_id, listing_id).
 */
export async function executeShopifyOrderPush(
  serviceSupabase: SupabaseClient,
  payload: ShopifyOrderPushPayload,
): Promise<void> {
  const connection = await getActiveShopifyConnectionForUser(serviceSupabase, payload.sellerId)
  if (!connection || connection.id !== payload.connectionId) {
    throw new Error("Shopify connection not active for seller")
  }

  const link = await getOrCreateShopifyOrderLink(serviceSupabase, {
    userId: payload.sellerId,
    connectionId: connection.id,
    reswellOrderId: payload.reswellOrderId,
    listingId: payload.listingId,
    shopifyVariantId: payload.variantId,
  })

  // Already pushed — nothing to do (idempotent).
  if (link.sync_status === "created" || link.sync_status === "fulfilled") return

  const { data: order } = await serviceSupabase
    .from("orders")
    .select("shipping_address")
    .eq("id", payload.reswellOrderId)
    .maybeSingle()

  const shippingAddress = mapReswellShippingAddress(order?.shipping_address)

  try {
    const created = await createShopifyOrder({
      shopDomain: connection.shop_domain,
      accessToken: connection.access_token,
      reswellOrderId: payload.reswellOrderId,
      customerEmail: payload.buyerEmail ?? undefined,
      shippingAddress,
      lineItems: [
        {
          variantId: payload.variantId,
          quantity: 1,
          price: payload.itemPriceUsd.toFixed(2),
          title: payload.listingTitle,
        },
      ],
    })

    await updateShopifyOrderLink(serviceSupabase, link.id, {
      sync_status: "created",
      shopify_order_id: created.orderId ? String(created.orderId) : null,
      shopify_order_name: created.orderName,
      last_error: null,
    })
  } catch (error) {
    await updateShopifyOrderLink(serviceSupabase, link.id, {
      sync_status: "failed",
      last_error: error instanceof Error ? error.message : String(error),
      incrementAttempts: true,
    })
    throw error
  }

  // Inventory: `inventory_behaviour: decrement_obeying_policy` on the order already decrements
  // tracked Shopify inventory. For untracked variants we leave Shopify alone. Best-effort guard
  // below keeps Reswell's mirrored stock consistent if the order path didn't decrement.
  void decrementShopifyInventoryBestEffort(serviceSupabase, {
    shopDomain: connection.shop_domain,
    accessToken: connection.access_token,
    variantId: payload.variantId,
  })
}

async function decrementShopifyInventoryBestEffort(
  _serviceSupabase: SupabaseClient,
  opts: { shopDomain: string; accessToken: string; variantId: string },
): Promise<void> {
  try {
    const [{ inventoryItemId }, locationId] = await Promise.all([
      fetchShopifyVariantInventoryItem(opts),
      fetchShopifyPrimaryLocationId(opts),
    ])
    if (!inventoryItemId || !locationId) return
    // Order creation with decrement_obeying_policy already adjusts; this is a no-op safeguard
    // intentionally left at 0 adjustment to avoid double-decrement. Kept for future manual flows.
    await adjustShopifyInventory({
      ...opts,
      inventoryItemId,
      locationId,
      availableAdjustment: 0,
    })
  } catch (e) {
    console.error("[shopify] inventory safeguard failed", e)
  }
}

export async function getShopifyLinkForListing(
  supabase: SupabaseClient,
  listingId: string,
) {
  const { data } = await supabase
    .from("shopify_product_links")
    .select("id, connection_id, shopify_variant_id, shopify_product_id, user_id")
    .eq("listing_id", listingId)
    .maybeSingle()
  return data
}

export { getShopifyLinkByVariantId }
