/**
 * Re-emit Klaviyo **Order Refunded** for an already-refunded order (buyer + seller).
 * Uses a fresh unique_id suffix so Klaviyo treats it as a new event / flow trigger.
 *
 * Usage:
 *   npx tsx scripts/reemit-order-refunded.ts <order_uuid|order_num>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { emitKlaviyoOrderRefundedForOrder } from "@/lib/services/klaviyoOrderRefunded"
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
    console.error("Usage: npx tsx scripts/reemit-order-refunded.ts <order_uuid|order_num>")
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
    .select("id, order_num, status, payment_method, refunded_at")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    console.error("Order not found:", orderId, orderErr?.message ?? "")
    process.exit(1)
  }

  if (order.status !== "refunded") {
    console.error(
      `Order ${order.order_num ?? order.id} status is "${order.status}", expected "refunded". Aborting.`,
    )
    process.exit(1)
  }

  const refundType = order.payment_method === "wallet" ? "wallet" : "stripe"
  const uniqueIdSuffix = `reemit-${Date.now()}`

  console.log("Re-emitting Order Refunded for", {
    orderId: order.id,
    orderNum: order.order_num,
    refundType,
    uniqueIdSuffix,
  })

  const result = await emitKlaviyoOrderRefundedForOrder(supabase, order.id, {
    refundType,
    source: "admin-reemit",
    uniqueIdSuffix,
  })

  if (!result.ok) {
    console.error("Failed:", result.error)
    process.exit(1)
  }

  console.log("OK — Klaviyo accepted Order Refunded (buyer + seller):", {
    orderId: result.orderId,
    orderNum: result.orderNum,
    buyerStatus: result.buyerStatus,
    sellerStatus: result.sellerStatus,
    uniqueIdSuffix: result.uniqueIdSuffix,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
