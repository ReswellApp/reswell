/**
 * Bulk import Grindhouse fin catalog from Thunderbit JSON export.
 * Remote product images are mirrored into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/import-grindhouse-fins-catalog.ts [--dry-run] [json-path]
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
  buildGrindhouseModelDescription,
  buildGrindhouseVariantDrafts,
  DEFAULT_GRINDHOUSE_FIN_JSON,
  GRINDHOUSE_FINS_BRAND_ID,
  loadGrindhouseFinJsonRows,
  preferGrindhouseProductImageUrl,
} from "@/lib/services/grindhouseFinCatalogJson"

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
  jsonPath: string,
  dryRun: boolean,
): Promise<void> {
  const rows = loadGrindhouseFinJsonRows(jsonPath)

  console.log(
    JSON.stringify(
      {
        brandId: GRINDHOUSE_FINS_BRAND_ID,
        jsonPath,
        dryRun,
        productCount: rows.length,
        estimatedVariants: rows.reduce((n, r) => n + buildGrindhouseVariantDrafts(r).length, 0),
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

  for (const row of rows) {
    const description = buildGrindhouseModelDescription(row)
    const variants = buildGrindhouseVariantDrafts(row)

    if (dryRun) {
      modelsCreated++
      variantsCreated += variants.length
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: preferGrindhouseProductImageUrl(row.productImage.split(/\n/)[0]?.trim() ?? "") || null,
      kind: "model",
      logLabel: "import grindhouse fins",
    })

    const modelResult = await insertBrandModel(supabase, {
      brand_id: GRINDHOUSE_FINS_BRAND_ID,
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
    let sortOrder = await maxSortOrderForBrandModel(supabase, modelId)

    for (const variant of variants) {
      sortOrder += 1
      const variantImageUrl =
        (await resolveMirroredBrandCatalogImageUrl({
          cache: imageCache,
          supabase,
          supabaseUrl,
          sourceUrl: variant.image_url,
          kind: "variant",
          logLabel: "import grindhouse fins",
        })) ?? modelImageUrl

      const variantResult = await insertBrandModelVariant(supabase, {
        brand_id: GRINDHOUSE_FINS_BRAND_ID,
        brand_model_id: modelId,
        length_label: "",
        width_label: "",
        thickness_label: "",
        volume_label: "",
        fin_box_type: variant.fin_box_type,
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
        sort_order: sortOrder,
      })

      if (!variantResult.ok) {
        if (variantResult.code === "23505") {
          skippedVariants++
          continue
        }
        errors.push(
          `Variant failed (${row.productName} / ${variant.configuration_label || "default"}): ${variantResult.error}`,
        )
        continue
      }
      variantsCreated++
    }
  }

  if (!dryRun) {
    const { count, error: countError } = await supabase
      .from("brand_models")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", GRINDHOUSE_FINS_BRAND_ID)

    if (!countError && count != null) {
      await supabase.from("brands").update({ model_count: count }).eq("id", GRINDHOUSE_FINS_BRAND_ID)
    }
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
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_GRINDHOUSE_FIN_JSON

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
