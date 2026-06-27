/**
 * Backfill post-commit side effects for an order that was inserted but did not finish
 * settlement (e.g. recovery script crashed on Next.js cache revalidation).
 *
 * Usage:
 *   npx tsx scripts/backfill-order-settlement-side-effects.ts <order_id>
 *   npx tsx scripts/backfill-order-settlement-side-effects.ts pi_3Tn3BVDUWcatSsWO1qg1jQwP
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { safeRevalidateAfterMarketplaceOrderCommit } from "@/lib/cache/safe-revalidate-after-order"
import { notifySellerOrderCheckoutKlaviyo } from "@/lib/services/notifySellerOrderCheckoutKlaviyo"
import { releaseOrderSellerEarningsAfterFulfillment } from "@/lib/services/releaseOrderSellerEarnings"
import { createServiceRoleClient } from "@/lib/supabase/server"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

async function resolveOrderId(ref: string): Promise<string | null> {
  const service = createServiceRoleClient()
  if (ref.startsWith("pi_")) {
    const { data } = await service
      .from("orders")
      .select("id")
      .eq("stripe_checkout_session_id", ref)
      .maybeSingle()
    return data?.id ?? null
  }
  return ref
}

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const ref = process.argv[2]?.trim()
  if (!ref) {
    console.error("Usage: npx tsx scripts/backfill-order-settlement-side-effects.ts <order_id|pi_…>")
    process.exit(1)
  }

  const orderId = await resolveOrderId(ref)
  if (!orderId) {
    console.error("Order not found for:", ref)
    process.exit(1)
  }

  const service = createServiceRoleClient()
  const { data: order } = await service
    .from("orders")
    .select(
      `
      id,
      order_num,
      seller_id,
      listing_id,
      sales_channel,
      delivery_status,
      listings ( id, slug, title, status )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (!order?.seller_id || !order.listing_id) {
    console.error("Order missing seller or listing:", order)
    process.exit(1)
  }

  console.log("Backfilling side effects for order:", {
    id: order.id,
    order_num: order.order_num,
    sales_channel: order.sales_channel,
    listing: order.listings,
  })

  await notifySellerOrderCheckoutKlaviyo(service, orderId)
  console.log("Seller Klaviyo notification sent (idempotent uniqueId per order).")

  if (order.sales_channel === "admin_terminal" && order.delivery_status === "picked_up") {
    const release = await releaseOrderSellerEarningsAfterFulfillment(orderId)
    console.log("Admin terminal earnings release:", release)
  }

  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  await safeRevalidateAfterMarketplaceOrderCommit(service, {
    sellerUserId: order.seller_id,
    listingIds: [order.listing_id],
    listingSlugs: [listing?.slug ?? null],
  })
  console.log("Cache revalidation attempted (no-op outside Next.js).")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
