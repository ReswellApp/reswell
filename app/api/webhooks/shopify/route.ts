import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getShopifyConnectionByShopDomain } from "@/lib/db/shopify-connections"
import { verifyShopifyWebhookHmac } from "@/lib/shopify/crypto"
import {
  archiveShopifyLinkedListing,
  syncShopifyVariantToListing,
} from "@/lib/services/shopifySync"
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
  const connection = await getShopifyConnectionByShopDomain(serviceSupabase, shopDomain)
  if (!connection) {
    return NextResponse.json({ received: true, skipped: "unknown_shop" })
  }

  try {
    if (topic === "products/delete") {
      const product = payload as { id?: number }
      if (!product.id) return NextResponse.json({ received: true })

      const { data: links } = await serviceSupabase
        .from("shopify_product_links")
        .select("shopify_variant_id")
        .eq("connection_id", connection.id)
        .eq("shopify_product_id", String(product.id))

      for (const link of links ?? []) {
        await archiveShopifyLinkedListing({
          serviceSupabase,
          connectionId: connection.id,
          variantId: link.shopify_variant_id,
        })
      }

      return NextResponse.json({ received: true, action: "archived" })
    }

    if (topic === "products/create" || topic === "products/update") {
      const product = payload as ShopifyRestProduct
      if (!product.id || !Array.isArray(product.variants)) {
        return NextResponse.json({ received: true, skipped: "invalid_product" })
      }

      for (const variant of product.variants) {
        const { data: existingLink } = await serviceSupabase
          .from("shopify_product_links")
          .select("id")
          .eq("connection_id", connection.id)
          .eq("shopify_variant_id", String(variant.id))
          .maybeSingle()

        if (!existingLink && topic === "products/create") {
          continue
        }

        if (existingLink || topic === "products/update") {
          await syncShopifyVariantToListing({
            supabase: serviceSupabase,
            serviceSupabase,
            connection,
            productId: String(product.id),
            variantId: String(variant.id),
            replaceImages: false,
          })
        }
      }

      return NextResponse.json({ received: true, action: "synced" })
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
        `https://${connection.shop_domain}/admin/api/2024-10/variants.json?inventory_item_ids=${inv.inventory_item_id}`,
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
      const inStock = stockQuantity > 0
      const { data: link } = await serviceSupabase
        .from("shopify_product_links")
        .select("listing_id")
        .eq("connection_id", connection.id)
        .eq("shopify_variant_id", String(variant.id))
        .maybeSingle()

      if (link?.listing_id) {
        await serviceSupabase
          .from("listings")
          .update({
            stock_quantity: stockQuantity,
            status: inStock ? "active" : "removed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", link.listing_id)
      }

      return NextResponse.json({ received: true, action: "inventory_updated" })
    }

    return NextResponse.json({ received: true, skipped: "unsupported_topic" })
  } catch (error) {
    console.error("[shopify webhook]", { topic, shopDomain, error })
    return NextResponse.json({ received: true, error: "handler_failed" })
  }
}
