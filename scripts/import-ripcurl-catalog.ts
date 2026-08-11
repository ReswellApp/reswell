/**
 * Create Ripcurl brand (wetsuits category) if missing, then bulk-import
 * Thunderbit wetsuit JSON into brand_models / brand_model_variants.
 * Remote product images are mirrored into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/import-ripcurl-catalog.ts [--dry-run] [json-path]
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
  buildRipcurlWetsuitModelDrafts,
  DEFAULT_RIPCURL_JSON,
  loadRipcurlWetsuitJsonRows,
  preferRipcurlProductImageUrl,
  RIPCURL_BRAND_NAME,
  RIPCURL_BRAND_SLUG,
  RIPCURL_WEBSITE_URL,
  WETSUIT_CATALOG_PRODUCT_CATEGORY,
} from "@/lib/services/ripcurlWetsuitCatalogJson"

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

async function ensureRipcurlBrand(supabase: SupabaseClient): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", RIPCURL_BRAND_SLUG)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to look up brand: ${selectError.message}`)
  }
  if (existing?.id) return existing.id as string

  const now = new Date().toISOString()
  const { data: created, error: insertError } = await supabase
    .from("brands")
    .insert({
      slug: RIPCURL_BRAND_SLUG,
      name: RIPCURL_BRAND_NAME,
      short_description: "Rip Curl wetsuits and surf gear.",
      website_url: RIPCURL_WEBSITE_URL,
      logo_url: null,
      founder_name: null,
      lead_shaper_name: null,
      location_label: null,
      model_count: 0,
      about_paragraphs: [],
      updated_at: now,
    })
    .select("id")
    .single()

  if (insertError || !created?.id) {
    throw new Error(`Failed to create Ripcurl brand: ${insertError?.message ?? "unknown"}`)
  }

  console.log(
    JSON.stringify({ createdBrand: true, brandId: created.id, slug: RIPCURL_BRAND_SLUG }, null, 2),
  )
  return created.id as string
}

async function ensureBrandHasWetsuitsCategory(
  supabase: SupabaseClient,
  brandId: string,
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("brand_product_categories")
    .select("category_slug")
    .eq("brand_id", brandId)
    .eq("category_slug", WETSUIT_CATALOG_PRODUCT_CATEGORY)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to check brand wetsuits category: ${selectError.message}`)
  }
  if (existing) return

  const { error: insertError } = await supabase.from("brand_product_categories").insert({
    brand_id: brandId,
    category_slug: WETSUIT_CATALOG_PRODUCT_CATEGORY,
  })

  if (insertError && insertError.code !== "23505") {
    throw new Error(`Failed to tag brand with wetsuits category: ${insertError.message}`)
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
    .eq("product_category_slug", WETSUIT_CATALOG_PRODUCT_CATEGORY)
    .eq("name", name)
    .maybeSingle()

  if (error || !data) return null
  return data.id as string
}

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  jsonPath: string,
  dryRun: boolean,
): Promise<void> {
  const rows = loadRipcurlWetsuitJsonRows(jsonPath)
  const models = buildRipcurlWetsuitModelDrafts(rows)

  console.log(
    JSON.stringify(
      {
        brandSlug: RIPCURL_BRAND_SLUG,
        productCategory: WETSUIT_CATALOG_PRODUCT_CATEGORY,
        jsonPath,
        dryRun,
        sourceRowCount: rows.length,
        modelCount: models.length,
        estimatedVariants: models.reduce((n, m) => n + m.variants.length, 0),
      },
      null,
      2,
    ),
  )

  if (dryRun) {
    for (const model of models.slice(0, 5)) {
      console.log(
        JSON.stringify(
          {
            name: model.productName,
            variantCount: model.variants.length,
            sampleVariants: model.variants.slice(0, 3).map((v) => ({
              size: v.configuration_label,
              color: v.fin_color_label,
              price: v.price,
            })),
          },
          null,
          2,
        ),
      )
    }
    console.log(JSON.stringify({ done: true, dryRun: true, modelsPreviewed: Math.min(5, models.length) }))
    return
  }

  const brandId = await ensureRipcurlBrand(supabase)
  await ensureBrandHasWetsuitsCategory(supabase, brandId)

  let modelsCreated = 0
  let modelsMerged = 0
  let variantsCreated = 0
  let skippedModels = 0
  let skippedVariants = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const model of models) {
    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: model.image_url,
      kind: "model",
      logLabel: "import ripcurl wetsuits",
    })

    const modelResult = await insertBrandModel(supabase, {
      brand_id: brandId,
      name: model.productName,
      description: model.description,
      image_url: modelImageUrl,
      product_category_slug: WETSUIT_CATALOG_PRODUCT_CATEGORY,
      board_category_slug: null,
    })

    let modelId: string

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        const existingId = await getBrandModelIdByName(supabase, brandId, model.productName)
        if (!existingId) {
          skippedModels++
          errors.push(`Model exists but wetsuits lookup failed: ${model.productName}`)
          continue
        }
        modelId = existingId
        modelsMerged++
      } else {
        errors.push(`Model failed (${model.productName}): ${modelResult.error}`)
        continue
      }
    } else {
      modelsCreated++
      modelId = modelResult.row.id
    }

    let sortOrder = await maxSortOrderForBrandModel(supabase, modelId)

    for (const variant of model.variants) {
      sortOrder += 1
      const variantImageUrl =
        (await resolveMirroredBrandCatalogImageUrl({
          cache: imageCache,
          supabase,
          supabaseUrl,
          sourceUrl: preferRipcurlProductImageUrl(variant.image_url ?? "") || null,
          kind: "variant",
          logLabel: "import ripcurl wetsuits",
        })) ?? modelImageUrl

      const variantResult = await insertBrandModelVariant(supabase, {
        brand_id: brandId,
        brand_model_id: modelId,
        length_label: "",
        width_label: "",
        thickness_label: "",
        volume_label: "",
        fin_box_type: "other",
        fin_boxes: "other",
        material: "other",
        condition: "brand_new",
        fin_size: null,
        configuration_label: variant.configuration_label,
        fin_base_label: "",
        fin_height_label: "",
        fin_foil_label: "",
        fin_color_label: variant.fin_color_label,
        product_category_slug: WETSUIT_CATALOG_PRODUCT_CATEGORY,
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
          `Variant failed (${model.productName} / ${variant.configuration_label || "default"} / ${variant.fin_color_label || "nocolor"}): ${variantResult.error}`,
        )
        continue
      }
      variantsCreated++
    }
  }

  const { count, error: countError } = await supabase
    .from("brand_models")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)

  if (!countError && count != null) {
    await supabase.from("brands").update({ model_count: count }).eq("id", brandId)
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        brandId,
        brandSlug: RIPCURL_BRAND_SLUG,
        productCategory: WETSUIT_CATALOG_PRODUCT_CATEGORY,
        modelsCreated,
        modelsMerged,
        variantsCreated,
        skippedModels,
        skippedVariants,
        errorCount: errors.length,
        errors: errors.slice(0, 40),
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
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_RIPCURL_JSON

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
