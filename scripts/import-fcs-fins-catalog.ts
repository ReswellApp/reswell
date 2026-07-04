/**
 * Bulk import FCS fin catalog from Thunderbit CSV export.
 * Remote product images are mirrored into Supabase `brand-assets` (never stored as CDN URLs).
 *
 * Usage:
 *   npx tsx scripts/import-fcs-fins-catalog.ts [--dry-run] [csv-path]
 *
 * Default csv-path: ~/Downloads/Thunderbit_0b8b19_20260625_234921.csv
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
  buildFcsVariantDrafts,
  DEFAULT_FCS_FIN_CSV,
  loadFcsFinCsvRows,
} from "@/lib/services/fcsFinCatalogCsv"
import { preferFullProductImageUrl } from "@/lib/services/trueAmesFinCatalogCsv"

/** surf-fcs brand — fins category */
const FCS_BRAND_ID = "51cd8cd1-5b0f-45da-81b5-606788cbd386"

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

async function getBrandModelIdByName(
  supabase: SupabaseClient,
  brandId: string,
  name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("brand_models")
    .select("id")
    .eq("brand_id", brandId)
    .eq("name", name)
    .maybeSingle()

  if (error || !data) return null
  return data.id as string
}

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  csvPath: string,
  dryRun: boolean,
): Promise<void> {
  const parsed = loadFcsFinCsvRows(csvPath)

  console.log(
    JSON.stringify(
      {
        brandId: FCS_BRAND_ID,
        csvPath,
        dryRun,
        productCount: parsed.length,
        estimatedVariants: parsed.reduce((n, r) => n + buildFcsVariantDrafts(r).length, 0),
      },
      null,
      2,
    ),
  )

  let modelsCreated = 0
  let variantsCreated = 0
  let skippedModels = 0
  let mergedModels = 0
  let skippedVariants = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const row of parsed) {
    const description = row.productOverview.trim() || null

    if (dryRun) {
      modelsCreated++
      variantsCreated += buildFcsVariantDrafts(row).length
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: preferFullProductImageUrl(row.productImage?.trim() ?? "") || null,
      kind: "model",
      logLabel: "import fcs",
    })

    const modelResult = await insertBrandModel(supabase, {
      brand_id: FCS_BRAND_ID,
      name: row.productName,
      description,
      image_url: modelImageUrl,
      product_category_slug: "fins",
    })

    let modelId: string

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        const existingId = await getBrandModelIdByName(supabase, FCS_BRAND_ID, row.productName)
        if (!existingId) {
          skippedModels++
          errors.push(`Model exists but lookup failed: ${row.productName}`)
          continue
        }
        modelId = existingId
        mergedModels++
      } else {
        errors.push(`Model failed (${row.productName}): ${modelResult.error}`)
        continue
      }
    } else {
      modelsCreated++
      modelId = modelResult.row.id
    }

    let sortOrder = await maxSortOrderForBrandModel(supabase, modelId)

    for (const variant of buildFcsVariantDrafts(row)) {
      sortOrder += 1
      const variantImageUrl = await resolveMirroredBrandCatalogImageUrl({
        cache: imageCache,
        supabase,
        supabaseUrl,
        sourceUrl: preferFullProductImageUrl(variant.image_url?.trim() ?? "") || null,
        kind: "variant",
        logLabel: "import fcs",
      })
      const variantResult = await insertBrandModelVariant(supabase, {
        brand_id: FCS_BRAND_ID,
        brand_model_id: modelId,
        length_label: "",
        width_label: "",
        thickness_label: "",
        volume_label: "",
        fin_box_type: variant.fin_box_type,
        fin_boxes: variant.fin_boxes,
        fin_size: variant.fin_size,
        material: "other",
        condition: "brand_new",
        configuration_label: variant.configuration_label,
        fin_base_label: variant.fin_base_label,
        fin_height_label: variant.fin_height_label,
        fin_foil_label: variant.fin_foil_label,
        fin_color_label: variant.fin_color_label,
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
          `Variant failed (${row.productName} / ${variant.fin_color_label || "default"}): ${variantResult.error}`,
        )
        continue
      }
      variantsCreated++
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
        mergedModels,
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
  const csvPath = csvArg ? resolve(csvArg) : DEFAULT_FCS_FIN_CSV

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
