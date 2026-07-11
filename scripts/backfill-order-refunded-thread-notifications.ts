/**
 * Backfill /messages thread notifications for sellers on fully refunded orders.
 *
 * Usage:
 *   npx tsx scripts/backfill-order-refunded-thread-notifications.ts
 *   npx tsx scripts/backfill-order-refunded-thread-notifications.ts <order_id>
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { REAL_MARKETPLACE_SALES_FILTER } from "@/lib/order-admin-test"
import { ensureOrderRefundedSellerThreadNotification } from "@/lib/services/postOrderRefundedThreadNotification"
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

async function backfillOne(service: ReturnType<typeof createServiceRoleClient>, orderId: string) {
  await ensureOrderRefundedSellerThreadNotification(service, orderId)
}

async function main() {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const service = createServiceRoleClient()
  const singleOrderId = process.argv[2]?.trim()

  if (singleOrderId) {
    console.log("Backfilling refund thread notification for order:", singleOrderId)
    await backfillOne(service, singleOrderId)
    console.log("Done.")
    return
  }

  const pageSize = 100
  let offset = 0
  let processed = 0

  console.log("Backfilling refund thread notifications for all refunded marketplace orders…")

  for (;;) {
    const { data: orders, error } = await service
      .from("orders")
      .select("id")
      .eq("status", "refunded")
      .match(REAL_MARKETPLACE_SALES_FILTER)
      .order("refunded_at", { ascending: true, nullsFirst: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error("Failed to load refunded orders:", error.message)
      process.exit(1)
    }

    const batch = orders ?? []
    if (batch.length === 0) break

    for (const row of batch) {
      const orderId = (row as { id: string }).id
      await backfillOne(service, orderId)
      processed++
      if (processed % 25 === 0) {
        console.log(`Processed ${processed} orders…`)
      }
    }

    if (batch.length < pageSize) break
    offset += pageSize
  }

  console.log(`Done. Processed ${processed} refunded order(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
