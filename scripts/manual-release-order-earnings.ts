/**
 * Manually release seller earnings for an order (same path as admin UI).
 *
 * Usage:
 *   npx tsx scripts/manual-release-order-earnings.ts <order_num|uuid>
 *   npx tsx scripts/manual-release-order-earnings.ts <order_num|uuid> --force
 *
 * `--force` marks an unshipped (`pending`) shipping order as shipped first so the
 * delivery finalize + wallet release path can run (admin override; no tracking required).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { markShippingDeliveredAndReleaseSellerEarnings } from "@/lib/services/shippingDeliveredFinalize"
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
      if (!value || process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

async function main() {
  loadEnvFile(".env.local")

  const args = process.argv.slice(2).map((a) => a.trim()).filter(Boolean)
  const force = args.includes("--force")
  const arg = args.find((a) => a !== "--force")
  if (!arg) {
    console.error(
      "Usage: npx tsx scripts/manual-release-order-earnings.ts <order_num|uuid> [--force]",
    )
    process.exit(1)
  }

  const svc = createServiceRoleClient()
  let orderId: string

  if (isUuid(arg)) {
    orderId = arg
  } else {
    const { data: order, error } = await svc
      .from("orders")
      .select("id, order_num")
      .ilike("order_num", arg.replace(/^#/, ""))
      .maybeSingle()
    if (error || !order) {
      console.error("Order not found for order_num:", arg, error?.message ?? "")
      process.exit(1)
    }
    orderId = order.id as string
    console.log("Resolved order:", order.order_num, orderId)
  }

  const { data: before } = await svc
    .from("orders")
    .select(
      "id, order_num, status, fulfillment_method, delivery_status, carrier_delivered_at, seller_earnings, amount, tracking_number",
    )
    .eq("id", orderId)
    .maybeSingle()

  const { data: payoutBefore } = await svc
    .from("payouts")
    .select("status, hold_reason, released_at")
    .eq("order_id", orderId)
    .maybeSingle()

  console.log("Before:", JSON.stringify({ order: before, payout: payoutBefore }, null, 2))

  if (
    force &&
    before &&
    (before as { fulfillment_method?: string | null }).fulfillment_method === "shipping" &&
    (before as { delivery_status?: string }).delivery_status === "pending"
  ) {
    const nowIso = new Date().toISOString()
    const { error: shipErr } = await svc
      .from("orders")
      .update({ delivery_status: "shipped", updated_at: nowIso })
      .eq("id", orderId)
      .eq("delivery_status", "pending")
    if (shipErr) {
      console.error("Could not force-mark shipped:", shipErr.message)
      process.exit(1)
    }
    console.log("Force: marked delivery_status=shipped (no tracking on order)")
  }

  const result = await markShippingDeliveredAndReleaseSellerEarnings(orderId)
  if (!result.ok) {
    console.error("Release failed:", result.error)
    process.exit(1)
  }

  const { data: payoutAfter } = await svc
    .from("payouts")
    .select("status, hold_reason, released_at")
    .eq("order_id", orderId)
    .maybeSingle()

  const { data: after } = await svc
    .from("orders")
    .select("id, order_num, status, delivery_status")
    .eq("id", orderId)
    .maybeSingle()

  console.log(
    "Release ok:",
    JSON.stringify(
      {
        transitionedToDelivered: result.transitionedToDelivered,
        walletReleasedNew: result.walletReleasedNew,
        order: after,
        payout: payoutAfter,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
