/**
 * Bulk import Facebook Marketplace listings from Thunderbit JSON export
 * into public.fb_marketplace_catalog (staging before brand_model_variants).
 *
 * Usage:
 *   npx tsx scripts/import-fb-marketplace-catalog.ts [--dry-run] [json-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertFbMarketplaceCatalogRows } from "@/lib/db/fb-marketplace-catalog"
import { fbMarketplaceCatalogBulkInsertSchema } from "@/lib/validations/fb-marketplace-catalog"
import {
  DEFAULT_FB_MARKETPLACE_JSON,
  loadFbMarketplaceThunderbitRows,
  toFbMarketplaceCatalogInsert,
} from "@/lib/services/fbMarketplaceCatalogJson"

const INSERT_BATCH_SIZE = 100

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
    // optional env file
  }
}

async function listExistingSourceUrls(supabase: SupabaseClient): Promise<Set<string>> {
  const existing = new Set<string>()
  const pageSize = 500
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("fb_marketplace_catalog")
      .select("source_url")
      .not("source_url", "is", null)
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(`Failed to check existing source URLs: ${error.message}`)
    }

    const rows = data ?? []
    for (const row of rows) {
      const url = (row as { source_url: string | null }).source_url
      if (url?.trim()) existing.add(url.trim())
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return existing
}

async function importCatalog(
  supabase: SupabaseClient,
  jsonPath: string,
  dryRun: boolean,
): Promise<void> {
  const parsed = loadFbMarketplaceThunderbitRows(jsonPath)
  const drafts = parsed.map(toFbMarketplaceCatalogInsert)
  const validated = fbMarketplaceCatalogBulkInsertSchema.parse(drafts)

  const existingUrls = dryRun
    ? new Set<string>()
    : await listExistingSourceUrls(supabase)

  const toInsert = validated.filter((row) => {
    const url = row.source_url?.trim()
    if (!url) return true
    return !existingUrls.has(url)
  })

  const skippedDuplicates = validated.length - toInsert.length

  console.log(
    JSON.stringify(
      {
        jsonPath,
        dryRun,
        parsedCount: parsed.length,
        validatedCount: validated.length,
        skippedDuplicates,
        insertCount: toInsert.length,
      },
      null,
      2,
    ),
  )

  if (dryRun || !toInsert.length) return

  let insertedCount = 0
  const errors: string[] = []

  for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_BATCH_SIZE)
    const result = await insertFbMarketplaceCatalogRows(supabase, chunk)
    if (!result.ok) {
      errors.push(`Batch ${i / INSERT_BATCH_SIZE + 1}: ${result.error}`)
      continue
    }
    insertedCount += result.insertedCount
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        insertedCount,
        skippedDuplicates,
        errorCount: errors.length,
        errors: errors.slice(0, 20),
      },
      null,
      2,
    ),
  )
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const jsonArg = args.find((a) => !a.startsWith("--"))
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_FB_MARKETPLACE_JSON

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)
  await importCatalog(supabase, jsonPath, dryRun)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
