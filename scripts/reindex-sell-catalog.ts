/**
 * Rebuild the cross-category sell catalog Elasticsearch index
 * (`reswell_sell_catalog`) from Supabase brands + brand_models.
 *
 * Usage:
 *   npx tsx scripts/reindex-sell-catalog.ts [--verify "query"]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  reindexSellCatalogFromSupabase,
  searchSellCatalogHitsFromElasticsearch,
} from "@/lib/elasticsearch/sell-catalog-index"

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
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // Optional env file — ignore when absent.
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  if (!isElasticsearchConfigured()) {
    console.error(
      "Elasticsearch is not configured. Set ELASTICSEARCH_URL plus credentials in .env.local.",
    )
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  console.log("Rebuilding sell catalog index…")
  const started = Date.now()
  const result = await reindexSellCatalogFromSupabase(supabase)
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(
    `Done in ${seconds}s — brands: ${result.brandsIndexed}, models: ${result.modelsIndexed}, errors: ${result.errors}`,
  )

  const verifyFlag = process.argv.indexOf("--verify")
  if (verifyFlag !== -1) {
    const q = process.argv[verifyFlag + 1] || "gato heroi dagger"
    console.log(`\nVerify search: "${q}"`)
    // Give ES a moment to make freshly indexed docs searchable.
    await new Promise((r) => setTimeout(r, 1500))
    const hits = await searchSellCatalogHitsFromElasticsearch(q, { limit: 10 })
    if (hits.length === 0) {
      console.log("No hits.")
    } else {
      for (const hit of hits) {
        console.log(`  ${hit.kind}  ${hit.id}  score=${hit.score.toFixed(2)}`)
      }
    }
  }

  process.exit(result.errors > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
