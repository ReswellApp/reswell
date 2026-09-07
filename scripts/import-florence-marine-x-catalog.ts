/**
 * Ensure Florence Marine X brand exists (apparel), then bulk-import models
 * from Thunderbit JSON export (name, description, hero image).
 *
 * Usage:
 *   npx tsx scripts/import-florence-marine-x-catalog.ts [--dry-run] [json-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { syncBrandProductCategories } from "@/lib/db/brand-product-categories"
import { insertBrandModel } from "@/lib/db/brand-models"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"
import {
  DEFAULT_FLORENCE_MARINE_X_JSON,
  FLORENCE_MARINE_X_BRAND_NAME,
  FLORENCE_MARINE_X_BRAND_SLUG,
  FLORENCE_MARINE_X_WEBSITE_URL,
  loadFlorenceMarineXJsonRows,
  resolveFlorenceMarineXModelImage,
} from "@/lib/services/florenceMarineXApparelCatalogJson"

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

async function ensureFlorenceMarineXBrand(supabase: SupabaseClient): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", FLORENCE_MARINE_X_BRAND_SLUG)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to look up brand: ${existingError.message}`)
  }

  let brandId = existing?.id as string | undefined

  if (!brandId) {
    const now = new Date().toISOString()
    const { data: inserted, error: insertError } = await supabase
      .from("brands")
      .insert({
        slug: FLORENCE_MARINE_X_BRAND_SLUG,
        name: FLORENCE_MARINE_X_BRAND_NAME,
        short_description: null,
        website_url: FLORENCE_MARINE_X_WEBSITE_URL,
        logo_url: null,
        founder_name: null,
        lead_shaper_name: null,
        location_label: null,
        model_count: 0,
        about_paragraphs: [],
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single()

    if (insertError || !inserted?.id) {
      throw new Error(`Failed to create brand: ${insertError?.message ?? "unknown error"}`)
    }
    brandId = inserted.id as string
    console.log(`Created brand ${FLORENCE_MARINE_X_BRAND_NAME} (${brandId})`)
  } else {
    const { error: updateError } = await supabase
      .from("brands")
      .update({
        name: FLORENCE_MARINE_X_BRAND_NAME,
        website_url: FLORENCE_MARINE_X_WEBSITE_URL,
        updated_at: new Date().toISOString(),
      })
      .eq("id", brandId)

    if (updateError) {
      throw new Error(`Failed to update brand: ${updateError.message}`)
    }
    console.log(`Using existing brand ${FLORENCE_MARINE_X_BRAND_NAME} (${brandId})`)
  }

  const sync = await syncBrandProductCategories(supabase, brandId, ["apparel"])
  if (!sync.ok) {
    throw new Error(`Failed to set apparel category: ${sync.error}`)
  }
  console.log("Tagged brand product categories: apparel")

  return brandId
}

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  jsonPath: string,
  dryRun: boolean,
): Promise<void> {
  const brandId = dryRun
    ? "dry-run-brand-id"
    : await ensureFlorenceMarineXBrand(supabase)
  const rows = loadFlorenceMarineXJsonRows(jsonPath)

  console.log(
    JSON.stringify(
      {
        brandId,
        brandSlug: FLORENCE_MARINE_X_BRAND_SLUG,
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
    if (dryRun) {
      modelsCreated++
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: resolveFlorenceMarineXModelImage(row.productImage),
      kind: "model",
      logLabel: "import florence marine x",
    })

    const description = row.productDescription.trim() || null

    const modelResult = await insertBrandModel(supabase, {
      brand_id: brandId,
      name: row.productName,
      description,
      image_url: modelImageUrl,
      product_category_slug: "apparel",
    })

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        const { data: existing, error: existingError } = await supabase
          .from("brand_models")
          .select("id, image_url")
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
          product_category_slug: "apparel",
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
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_FLORENCE_MARINE_X_JSON

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
