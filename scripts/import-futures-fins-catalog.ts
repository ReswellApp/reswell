/**
 * Bulk import Futures Fins catalog from Thunderbit CSV export.
 * Remote product images are mirrored into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/import-futures-fins-catalog.ts [--dry-run] [csv-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel } from "@/lib/db/brand-models"
import { insertBrandModelVariant, maxSortOrderForBrandModel } from "@/lib/db/brand-model-variants"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"
import {
  buildFuturesModelDescription,
  buildFuturesVariantDraft,
  DEFAULT_FUTURES_FIN_CSV,
  FUTURES_FINS_BRAND_ID,
  loadFuturesFinCsvRows,
  preferFuturesProductImageUrl,
} from "@/lib/services/futuresFinCatalogCsv"

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

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  csvPath: string,
  dryRun: boolean,
): Promise<void> {
  const parsed = loadFuturesFinCsvRows(csvPath)

  console.log(
    JSON.stringify(
      {
        brandId: FUTURES_FINS_BRAND_ID,
        csvPath,
        dryRun,
        productCount: parsed.length,
      },
      null,
      2,
    ),
  )

  let modelsCreated = 0
  let variantsCreated = 0
  let skippedModels = 0
  let skippedVariants = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const row of parsed) {
    const description = buildFuturesModelDescription(row)
    const variant = buildFuturesVariantDraft(row)

    if (dryRun) {
      modelsCreated++
      variantsCreated++
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: preferFuturesProductImageUrl(row.productImage?.trim() ?? "") || null,
      kind: "model",
      logLabel: "import futures fins",
    })

    const modelResult = await insertBrandModel(supabase, {
      brand_id: FUTURES_FINS_BRAND_ID,
      name: row.productName,
      description,
      image_url: modelImageUrl,
      product_category_slug: "fins",
    })

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        skippedModels++
        errors.push(`Model exists, skipped: ${row.productName}`)
        continue
      }
      errors.push(`Model failed (${row.productName}): ${modelResult.error}`)
      continue
    }

    modelsCreated++
    const modelId = modelResult.row.id
    const variantImageUrl =
      (await resolveMirroredBrandCatalogImageUrl({
        cache: imageCache,
        supabase,
        supabaseUrl,
        sourceUrl: preferFuturesProductImageUrl(variant.image_url?.trim() ?? "") || null,
        kind: "model",
        logLabel: "import futures fins",
      })) ?? modelImageUrl

    const variantResult = await insertBrandModelVariant(supabase, {
      brand_id: FUTURES_FINS_BRAND_ID,
      brand_model_id: modelId,
      length_label: "",
      width_label: "",
      thickness_label: "",
      volume_label: "",
      fin_box_type: "futures",
      fin_boxes: variant.fin_boxes,
      material: variant.material,
      condition: "brand_new",
      fin_size: variant.fin_size,
      configuration_label: variant.configuration_label,
      fin_base_label: variant.fin_base_label,
      fin_height_label: variant.fin_height_label,
      fin_foil_label: variant.fin_foil_label,
      fin_color_label: "",
      product_category_slug: "fins",
      price: variant.price,
      image_url: variantImageUrl,
      sort_order: (await maxSortOrderForBrandModel(supabase, modelId)) + 1,
    })

    if (!variantResult.ok) {
      if (variantResult.code === "23505") {
        skippedVariants++
        continue
      }
      errors.push(`Variant failed (${row.productName}): ${variantResult.error}`)
      continue
    }
    variantsCreated++
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        modelsCreated,
        variantsCreated,
        skippedModels,
        skippedVariants,
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
  const csvArg = args.find((a) => !a.startsWith("--"))
  const csvPath = csvArg ? resolve(csvArg) : DEFAULT_FUTURES_FIN_CSV

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(url, key)
  await importCatalog(supabase, url, csvPath, dryRun)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
