/**
 * Seed Klaviyo **Order Shipping Update** so flow filters learn `sms_milestone`.
 * Hits Klaviyo directly with KLAVIYO_API_KEY from `.env.local` (no CRON_SECRET).
 *
 * Usage:
 *   npx tsx scripts/bootstrap-order-shipping-update-metric.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { bootstrapOrderShippingUpdateMetric } from "@/lib/klaviyo/bootstrap-order-shipping-update-metric"

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

  if (!process.env.KLAVIYO_API_KEY?.trim()) {
    console.error("KLAVIYO_API_KEY is not set in .env.local")
    process.exit(1)
  }

  const { results } = await bootstrapOrderShippingUpdateMetric()
  console.log(JSON.stringify({ results }, null, 2))
  const ok = results.every((r) => r.ok)
  if (!ok) process.exit(1)
  console.log(
    "Done. Refresh Klaviyo Order Shipping Update flow filters — sms_milestone should appear.",
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
