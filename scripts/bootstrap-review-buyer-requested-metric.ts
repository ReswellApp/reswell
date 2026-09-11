/**
 * Seed Klaviyo **Review Buyer Requested** so it appears under Flows → Metric.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-review-buyer-requested-metric.ts
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { bootstrapReviewBuyerRequestedMetric } from "@/lib/klaviyo/bootstrap-review-buyer-requested-metric"

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

  const { result } = await bootstrapReviewBuyerRequestedMetric()
  console.log(JSON.stringify({ result }, null, 2))
  if (!result.ok) process.exit(1)
  console.log(
    "Done. In Klaviyo: Flows → Create flow → Metric → Review Buyer Requested. Filter reswell_metric_seed is not true.",
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
