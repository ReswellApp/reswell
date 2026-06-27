/**
 * One-off recovery: settle a succeeded admin-terminal PaymentIntent into orders + sold listing.
 *
 * Usage:
 *   npx tsx scripts/recover-admin-terminal-sale.ts pi_3Tn3BVDUWcatSsWO1qg1jQwP
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { finalizeAdminTerminalSale } from "@/lib/services/adminTerminalSale"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"

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

  const piId = process.argv[2]?.trim()
  if (!piId?.startsWith("pi_")) {
    console.error("Usage: npx tsx scripts/recover-admin-terminal-sale.ts <payment_intent_id>")
    process.exit(1)
  }

  const stripe = getStripe()
  const pi = await stripe.paymentIntents.retrieve(piId)
  console.log("PaymentIntent:", {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    sales_channel: pi.metadata?.sales_channel,
    listing_id: pi.metadata?.listing_id ?? pi.metadata?.listing_ids,
    buyer_id: pi.metadata?.buyer_id ?? null,
    customer: pi.metadata?.terminal_customer_email ?? null,
  })

  const service = createServiceRoleClient()

  const { data: existingOrder } = await service
    .from("orders")
    .select("id, order_num, seller_id, buyer_id, listing_id, status, sales_channel")
    .eq("stripe_checkout_session_id", piId)
    .maybeSingle()

  if (existingOrder) {
    console.log("Existing order already linked to this PaymentIntent:", existingOrder)
    const listingId = existingOrder.listing_id as string
    const { data: listing } = await service
      .from("listings")
      .select("id, slug, title, status, hidden_from_site")
      .eq("id", listingId)
      .maybeSingle()
    console.log("Listing:", listing)
    process.exit(0)
  }

  console.log("No order yet — running finalizeAdminTerminalSale…")
  const result = await finalizeAdminTerminalSale(piId)
  if (!result.ok) {
    console.error("Finalize failed:", result.error, `(status ${result.status})`)
    process.exit(1)
  }

  console.log("Finalize OK:", result)

  const { data: order } = await service
    .from("orders")
    .select("id, order_num, seller_id, buyer_id, listing_id, status, sales_channel, amount")
    .eq("id", result.orderId)
    .maybeSingle()

  const { data: listing } = order?.listing_id
    ? await service
        .from("listings")
        .select("id, slug, title, status, hidden_from_site")
        .eq("id", order.listing_id as string)
        .maybeSingle()
    : { data: null }

  console.log("Order:", order)
  console.log("Listing:", listing)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
