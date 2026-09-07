/**
 * Emit missing buyer **Order Shipped** + seller **Seller Order Shipped** for an order
 * that is already shipped/delivered in Reswell.
 *
 * Usage:
 *   npx tsx scripts/emit-order-shipped-klaviyo.ts <order_uuid|order_num>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { notifyOrderShippedKlaviyoIfMissing } from "@/lib/services/notifyOrderShippedKlaviyo"
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

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const arg = process.argv[2]?.trim()
  if (!arg) {
    console.error("Usage: npx tsx scripts/emit-order-shipped-klaviyo.ts <order_uuid|order_num>")
    process.exit(1)
  }

  const supabase = createServiceRoleClient()

  let orderId = arg
  if (!/^[0-9a-f-]{36}$/i.test(arg)) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id")
      .eq("order_num", arg.toUpperCase())
      .maybeSingle()
    if (error || !order?.id) {
      console.error("Order not found for order_num:", arg, error?.message ?? "")
      process.exit(1)
    }
    orderId = order.id
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, order_num, fulfillment_method, delivery_status, tracking_number")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    console.error("Order not found:", orderId, orderErr?.message ?? "")
    process.exit(1)
  }

  console.log("Emitting shipped Klaviyo events for", {
    orderId: order.id,
    orderNum: order.order_num,
    deliveryStatus: order.delivery_status,
    hasTracking: Boolean(order.tracking_number),
  })

  await notifyOrderShippedKlaviyoIfMissing(supabase, order.id)
  console.log("OK — buyer Order Shipped + seller Seller Order Shipped sent or already logged")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
