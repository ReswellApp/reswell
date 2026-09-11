/**
 * Backfill Klaviyo `Review Buyer Requested` for fulfilled sales whose seller
 * has not reviewed the buyer yet.
 *
 * Usage:
 *   npx tsx scripts/backfill-review-buyer-requested.ts --dry-run
 *   npx tsx scripts/backfill-review-buyer-requested.ts --apply
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { backfillReviewBuyerRequested } from "@/lib/services/sellerReviewBuyerPrompt"

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

  const apply = process.argv.includes("--apply")
  if (!process.argv.includes("--dry-run") && !apply) {
    console.error("Usage: npx tsx scripts/backfill-review-buyer-requested.ts --dry-run|--apply")
    process.exit(1)
  }

  const result = await backfillReviewBuyerRequested({ dryRun: !apply })
  console.log(
    apply ? "Backfill complete." : "Dry run — no Klaviyo events sent.",
    result,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
