import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { googleMerchantProductLink } from "../lib/google-merchant/product-link"
import { listGoogleMerchantProductsDetailed } from "../lib/services/googleMerchantInsights"

const ISSUE_CODE = "attribute_pending_review"

function loadEnvFile(relativePath: string): void {
  try {
    const filePath = resolve(process.cwd(), relativePath)
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
    // optional env file
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  if (process.env.VERCEL_ENV !== "production") {
    loadEnvFile(".env.production.local")
  }

  const result = await listGoogleMerchantProductsDetailed()
  if (!result.ok) {
    console.error("Merchant API error:", result.error)
    process.exit(1)
  }

  const affected = result.products
    .filter((product) => product.issues.some((issue) => issue.code === ISSUE_CODE))
    .map((product) => {
      const issue = product.issues.find((i) => i.code === ISSUE_CODE)
      return {
        offerId: product.offerId,
        title: product.title,
        adsStatus: product.adsStatus,
        status: product.status,
        imageLink: product.imageLink,
        reswellLink: product.link,
        lastUpdateDate: product.lastUpdateDate,
        creationDate: product.creationDate,
        issueDescription: issue?.description ?? null,
        issueDetail: issue?.detail ?? null,
      }
    })
    .sort((a, b) => {
      const aDate = a.lastUpdateDate ?? a.creationDate ?? ""
      const bDate = b.lastUpdateDate ?? b.creationDate ?? ""
      return bDate.localeCompare(aDate)
    })

  console.log(`\nFound ${affected.length} products with ${ISSUE_CODE}\n`)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const slugById = new Map<string, string>()

  if (supabaseUrl && serviceKey && affected.length > 0) {
    const supabase = createClient(supabaseUrl, serviceKey)
    const ids = affected.map((row) => row.offerId)
    const { data } = await supabase.from("listings").select("id, slug, title").in("id", ids)
    for (const row of data ?? []) {
      if (row.slug?.trim()) slugById.set(row.id, row.slug.trim())
    }
  }

  for (const [index, row] of affected.entries()) {
    const slug = slugById.get(row.offerId)
    const adminListingUrl = slug
      ? `https://www.reswell.app/l/${encodeURIComponent(slug)}`
      : row.reswellLink ?? googleMerchantProductLink({ id: row.offerId, slug })

    console.log(`${index + 1}. ${row.title ?? "(no title)"}`)
    console.log(`   offer_id: ${row.offerId}`)
    console.log(`   status: ${row.status} · ads: ${row.adsStatus}`)
    console.log(`   listing: ${adminListingUrl}`)
    console.log(`   image: ${row.imageLink ?? "(none)"}`)
    if (row.lastUpdateDate) console.log(`   last updated: ${row.lastUpdateDate}`)
    console.log("")
  }

  console.log("---")
  console.log("CSV (copy into spreadsheet):")
  console.log("offer_id,title,listing_url,image_url,ads_status,last_update")
  for (const row of affected) {
    const slug = slugById.get(row.offerId)
    const listingUrl =
      slug != null
        ? `https://www.reswell.app/l/${encodeURIComponent(slug)}`
        : row.reswellLink ?? googleMerchantProductLink({ id: row.offerId, slug })
    const csv = [row.offerId, row.title ?? "", listingUrl, row.imageLink ?? "", row.adsStatus, row.lastUpdateDate ?? ""]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
    console.log(csv)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
