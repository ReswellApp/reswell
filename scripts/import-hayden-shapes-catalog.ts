/**
 * Bulk import Hayden Shapes surfboard catalog from Thunderbit JSON export.
 * Remote product images are mirrored into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/import-hayden-shapes-catalog.ts [--dry-run] [json-path]
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
  buildHaydenShapesModelDescription,
  buildHaydenShapesVariantDrafts,
  DEFAULT_HAYDEN_SHAPES_JSON,
  HAYDEN_SHAPES_BRAND_SLUG,
  loadHaydenShapesJsonRows,
  resolveHaydenShapesModelImage,
} from "@/lib/services/haydenShapesSurfboardCatalogJson"

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
    .eq("slug", HAYDEN_SHAPES_BRAND_SLUG)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Brand not found for slug "${HAYDEN_SHAPES_BRAND_SLUG}"`)
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
  const rows = loadHaydenShapesJsonRows(jsonPath)

  console.log(
    JSON.stringify(
      {
        brandId,
        brandSlug: HAYDEN_SHAPES_BRAND_SLUG,
        jsonPath,
        dryRun,
        productCount: rows.length,
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
    const description = buildHaydenShapesModelDescription(row)
    const variants = buildHaydenShapesVariantDrafts(row)

    if (dryRun) {
      modelsCreated++
      variantsCreated += variants.length
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: resolveHaydenShapesModelImage(row.productImage),
      kind: "model",
      logLabel: "import hayden shapes",
    })

    let modelId: string

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
          .select("id")
          .eq("brand_id", brandId)
          .ilike("name", row.productName.trim())
          .maybeSingle()

        if (existingError || !existing?.id) {
          skippedModels++
          errors.push(`Model exists but could not resolve id: ${row.productName}`)
          continue
        }

        modelId = existing.id
        skippedModels++
      } else {
        errors.push(`Model failed (${row.productName}): ${modelResult.error}`)
        continue
      }
    } else {
      modelsCreated++
      modelId = modelResult.row.id
    }
    let sortOrder = await maxSortOrderForBrandModel(supabase, modelId)

    for (const variant of variants) {
      sortOrder += 1
      const variantResult = await insertBrandModelVariant(supabase, {
        brand_id: brandId,
        brand_model_id: modelId,
        length_label: variant.length_label,
        width_label: variant.width_label,
        thickness_label: variant.thickness_label,
        volume_label: variant.volume_label,
        fin_box_type: variant.fin_box_type,
        fin_boxes: variant.fin_boxes,
        material: variant.material,
        condition: "brand_new",
        product_category_slug: "surfboards",
        price: variant.price,
        image_url: modelImageUrl,
        sort_order: sortOrder,
      })

      if (!variantResult.ok) {
        if (variantResult.code === "23505") {
          skippedVariants++
          continue
        }
        errors.push(
          `Variant failed (${row.productName} / ${variant.length_label}): ${variantResult.error}`,
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
  const jsonArg = args.find((a) => !a.startsWith("--"))
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_HAYDEN_SHAPES_JSON

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
