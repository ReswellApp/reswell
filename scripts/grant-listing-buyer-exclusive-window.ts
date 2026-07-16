/**
 * Grant a listing exclusive-buyer repurchase window.
 *
 * Usage:
 *   npx tsx scripts/grant-listing-buyer-exclusive-window.ts HFQUGM
 *   npx tsx scripts/grant-listing-buyer-exclusive-window.ts --listing-id <uuid> --buyer-id <uuid>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  LISTING_BUYER_EXCLUSIVE_WINDOW_DAYS,
  grantListingBuyerExclusiveWindow,
} from "@/lib/services/listingBuyerExclusiveWindow"

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

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const args = process.argv.slice(2)
  let orderNum: string | null = null
  let listingId: string | null = null
  let buyerId: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--listing-id") listingId = args[++i]?.trim() ?? null
    else if (arg === "--buyer-id") buyerId = args[++i]?.trim() ?? null
    else if (!arg.startsWith("--")) orderNum = arg.trim()
  }

  const supabase = createServiceRoleClient()

  if (orderNum && (!listingId || !buyerId)) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_num, buyer_id, listing_id, status")
      .ilike("order_num", orderNum)
      .maybeSingle()

    if (error || !order) {
      console.error("Order not found:", orderNum, error)
      process.exit(1)
    }

    listingId = (order.listing_id as string | null) ?? listingId
    buyerId = (order.buyer_id as string | null) ?? buyerId
    console.log("Resolved order:", {
      order_num: order.order_num,
      order_id: order.id,
      status: order.status,
      listing_id: listingId,
      buyer_id: buyerId,
    })
  }

  if (!listingId || !buyerId) {
    console.error(
      "Usage: npx tsx scripts/grant-listing-buyer-exclusive-window.ts <order_num>\n" +
        "   or: npx tsx scripts/grant-listing-buyer-exclusive-window.ts --listing-id <uuid> --buyer-id <uuid>",
    )
    process.exit(1)
  }

  await grantListingBuyerExclusiveWindow(supabase, {
    listingId,
    buyerId,
    days: LISTING_BUYER_EXCLUSIVE_WINDOW_DAYS,
  })

  const { data: listing, error: readErr } = await supabase
    .from("listings")
    .select("id, title, slug, exclusive_buyer_id, exclusive_buyer_until")
    .eq("id", listingId)
    .maybeSingle()

  if (readErr) {
    console.error("Grant may have failed — could not read listing:", readErr.message)
    console.error(
      "If columns are missing, run supabase/migrations/20270716130000_listing_exclusive_buyer_window.sql first.",
    )
    process.exit(1)
  }

  console.log("Exclusive buyer window set:", listing)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
