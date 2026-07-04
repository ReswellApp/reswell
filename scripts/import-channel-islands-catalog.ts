/**
 * Bulk import Channel Islands surfboard models from Thunderbit JSON export.
 * Imports model name, hero image, and description only (no variants).
 *
 * Usage:
 *   npx tsx scripts/import-channel-islands-catalog.ts [--dry-run] [json-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel } from "@/lib/db/brand-models"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"
import {
  buildChannelIslandsModelDescription,
  CHANNEL_ISLANDS_BRAND_SLUG,
  DEFAULT_CHANNEL_ISLANDS_JSON,
  loadChannelIslandsJsonRows,
  resolveChannelIslandsModelImage,
} from "@/lib/services/channelIslandsSurfboardCatalogJson"

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

async function resolveBrandId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", CHANNEL_ISLANDS_BRAND_SLUG)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Brand not found for slug "${CHANNEL_ISLANDS_BRAND_SLUG}"`)
  }
  return data.id
}

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  jsonPath: string,
  dryRun: boolean,
): Promise<void> {
  const brandId = await resolveBrandId(supabase)
  const rows = loadChannelIslandsJsonRows(jsonPath)

  console.log(
    JSON.stringify(
      {
        brandId,
        brandSlug: CHANNEL_ISLANDS_BRAND_SLUG,
        jsonPath,
        dryRun,
        productCount: rows.length,
      },
      null,
      2,
    ),
  )

  let modelsCreated = 0
  let modelsUpdated = 0
  let skippedModels = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const row of rows) {
    const description = buildChannelIslandsModelDescription(row)

    if (dryRun) {
      modelsCreated++
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: resolveChannelIslandsModelImage(row.productImage),
      kind: "model",
      logLabel: "import channel islands",
    })

    const modelResult = await insertBrandModel(supabase, {
      brand_id: brandId,
      name: row.productName,
      description,
      image_url: modelImageUrl,
      product_category_slug: "surfboards",
    })

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        const { data: existing, error: existingError } = await supabase
          .from("brand_models")
          .select("id, description, image_url")
          .eq("brand_id", brandId)
          .ilike("name", row.productName.trim())
          .maybeSingle()

        if (existingError || !existing?.id) {
          skippedModels++
          errors.push(`Model exists but could not resolve id: ${row.productName}`)
          continue
        }

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }
        if (description) {
          updates.description = description
        }
        if (modelImageUrl) {
          updates.image_url = modelImageUrl
        }

        const { error: updateError } = await supabase
          .from("brand_models")
          .update(updates)
          .eq("id", existing.id)

        if (updateError) {
          errors.push(`Model update failed (${row.productName}): ${updateError.message}`)
          continue
        }

        modelsUpdated++
        continue
      }

      errors.push(`Model failed (${row.productName}): ${modelResult.error}`)
      continue
    }

    modelsCreated++
  }

  if (!dryRun) {
    const { count, error: countError } = await supabase
      .from("brand_models")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)

    if (!countError && count != null) {
      await supabase.from("brands").update({ model_count: count }).eq("id", brandId)
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        modelsCreated,
        modelsUpdated,
        skippedModels,
        errorCount: errors.length,
        errors,
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
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_CHANNEL_ISLANDS_JSON

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)
  await importCatalog(supabase, url, jsonPath, dryRun)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
