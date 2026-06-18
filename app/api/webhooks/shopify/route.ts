import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getShopifyConnectionByShopDomain } from "@/lib/db/shopify-connections"
import { verifyShopifyWebhookHmac } from "@/lib/shopify/crypto"
import { shopifyRestBase } from "@/lib/shopify/config"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"
import { getShopifyLinkByProductId } from "@/lib/db/shopify-product-links"
import {
  getListingVariants,
  updateListingVariantStockByShopifyId,
} from "@/lib/db/listing-variants"
import { productMatchesSyncRules } from "@/lib/services/shopifyCatalog"
import {
  handleShopifyComplianceWebhook,
  isShopifyComplianceTopic,
} from "@/lib/services/shopifyCompliance"
import type { ShopifyRestProduct, ShopifyRestVariant } from "@/lib/shopify/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/webhooks/shopify
 * Handles Shopify product and inventory webhooks for linked sellers.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get("x-shopify-hmac-sha256")

  if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const shopDomain = request.headers.get("x-shopify-shop-domain")?.trim().toLowerCase()
  const topic = request.headers.get("x-shopify-topic")?.trim()

  if (!shopDomain || !topic) {
    return NextResponse.json({ received: true, skipped: "missing_headers" })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()

  // Lifecycle + GDPR topics must be handled even when no active connection exists
  // (e.g. shop/redact arrives ~48h after uninstall).
  if (isShopifyComplianceTopic(topic)) {
    const result = await handleShopifyComplianceWebhook({
      serviceSupabase,
      shopDomain,
      topic,
      payload,
    })
    return NextResponse.json({ received: true, ...result })
  }

  const connection = await getShopifyConnectionByShopDomain(serviceSupabase, shopDomain)
  if (!connection) {
    return NextResponse.json({ received: true, skipped: "unknown_shop" })
  }

  void serviceSupabase
    .from("shopify_connections")
    .update({ webhook_last_received_at: new Date().toISOString() })
    .eq("id", connection.id)
    .then(undefined, () => {})

  try {
    if (topic === "products/delete") {
      const product = payload as { id?: number }
      if (!product.id) return NextResponse.json({ received: true })

      await enqueueShopifySyncJob(serviceSupabase, {
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "product_delete",
        dedupeKey: `product_delete:${connection.id}:${product.id}`,
        payload: { connectionId: connection.id, productId: String(product.id) },
      })

      return NextResponse.json({ received: true, action: "queued_delete" })
    }

    if (topic === "products/create" || topic === "products/update") {
      const product = payload as ShopifyRestProduct
      if (!product.id || !Array.isArray(product.variants)) {
        return NextResponse.json({ received: true, skipped: "invalid_product" })
      }

      // Sync if already linked, or if it newly matches the seller's auto-sync rules.
      const existingLink = await getShopifyLinkByProductId(
        serviceSupabase,
        connection.id,
        String(product.id),
      )
      const shouldSync = existingLink !== null || productMatchesSyncRules(product, connection)

      if (!shouldSync) {
        return NextResponse.json({ received: true, skipped: "not_synced_product" })
      }

      await enqueueShopifySyncJob(serviceSupabase, {
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "product_sync",
        dedupeKey: `product_sync:${connection.id}:${product.id}`,
        payload: {
          connectionId: connection.id,
          sellerId: connection.user_id,
          productId: String(product.id),
        },
      })

      return NextResponse.json({ received: true, action: "queued_sync" })
    }

    if (topic === "inventory_levels/update") {
      const inv = payload as {
        inventory_item_id?: number
        available?: number
      }

      if (inv.inventory_item_id == null) {
        return NextResponse.json({ received: true, skipped: "no_inventory_item" })
      }

      const variantRes = await fetch(
        `${shopifyRestBase(connection.shop_domain)}/variants.json?inventory_item_ids=${inv.inventory_item_id}`,
        {
          headers: {
            "X-Shopify-Access-Token": connection.access_token,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      )

      if (!variantRes.ok) {
        return NextResponse.json({ received: true, skipped: "variant_lookup_failed" })
      }

      const variantJson = (await variantRes.json()) as { variants?: ShopifyRestVariant[] }
      const variant = variantJson.variants?.[0]
      if (!variant) {
        return NextResponse.json({ received: true, skipped: "variant_not_found" })
      }

      const stockQuantity = Math.max(0, inv.available ?? variant.inventory_quantity ?? 0)

      // Update the specific variant unit, then recompute the parent listing's aggregate stock/status.
      const updated = await updateListingVariantStockByShopifyId(
        serviceSupabase,
        String(variant.id),
        stockQuantity,
      )

      if (updated?.listingId) {
        const variants = await getListingVariants(serviceSupabase, updated.listingId)
        const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0)
        const anyInStock = variants.some((v) => v.in_stock)
        await serviceSupabase
          .from("listings")
          .update({
            stock_quantity: totalStock,
            status: anyInStock ? "active" : "removed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", updated.listingId)
      }

      return NextResponse.json({ received: true, action: "inventory_updated" })
    }

    return NextResponse.json({ received: true, skipped: "unsupported_topic" })
  } catch (error) {
    console.error("[shopify webhook]", { topic, shopDomain, error })
    return NextResponse.json({ received: true, error: "handler_failed" })
  }
}
