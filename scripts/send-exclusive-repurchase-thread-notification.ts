/**
 * Send exclusive repurchase follow-up in buyer↔seller /messages.
 *
 * Usage:
 *   npx tsx scripts/send-exclusive-repurchase-thread-notification.ts HFQUGM
 *   npx tsx scripts/send-exclusive-repurchase-thread-notification.ts <order_uuid>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteOrderExclusiveRepurchaseThreadNotifications,
  ensureOrderExclusiveRepurchaseThreadNotification,
} from "@/lib/services/postOrderExclusiveRepurchaseThreadNotification"

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
  const replace = args.includes("--replace")
  const arg = args.find((a) => a !== "--replace")?.trim()
  if (!arg) {
    console.error(
      "Usage: npx tsx scripts/send-exclusive-repurchase-thread-notification.ts [--replace] <order_num|order_id>",
    )
    process.exit(1)
  }

  const supabase = createServiceRoleClient()

  let orderId = arg
  if (!/^[0-9a-f-]{36}$/i.test(arg)) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_num")
      .ilike("order_num", arg)
      .maybeSingle()
    if (error || !order) {
      console.error("Order not found:", arg, error)
      process.exit(1)
    }
    orderId = order.id as string
    console.log("Resolved order:", order.order_num, orderId)
  }

  if (replace) {
    const deleted = await deleteOrderExclusiveRepurchaseThreadNotifications(supabase, orderId)
    console.log("Deleted prior exclusive-repurchase messages:", deleted)
  }

  await ensureOrderExclusiveRepurchaseThreadNotification(supabase, orderId)
  console.log("Exclusive repurchase follow-up sent (or already existed) for order:", orderId)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
