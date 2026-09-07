/**
 * Bulk import Firewire Surfboards FIN catalog from Thunderbit JSON export.
 * Models/variants are tagged product_category_slug = "fins" so they stay
 * separate from Firewire surfboard catalog rows on the same brand.
 * Remote product images are mirrored into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/import-firewire-fins-catalog.ts [--dry-run] [json-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel } from "@/lib/db/brand-models"
import { insertBrandModelVariant, maxSortOrderForBrandModel } from "@/lib/db/brand-model-variants"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"
import {
  buildFirewireFinModelDescription,
  buildFirewireFinVariantDrafts,
  DEFAULT_FIREWIRE_FIN_JSON,
  FIREWIRE_FINS_BRAND_SLUG,
  loadFirewireFinJsonRows,
  preferFirewireFinProductImageUrl,
  resolveFirewireFinModelImage,
} from "@/lib/services/firewireFinCatalogJson"

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
    .eq("slug", FIREWIRE_FINS_BRAND_SLUG)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Brand not found for slug "${FIREWIRE_FINS_BRAND_SLUG}"`)
  }
  return data.id
}

/**
 * Ensure Firewire is tagged as a fins manufacturer without removing surfboards.
 * Fin sell/search catalogs only include brands in brand_product_categories for "fins".
 */
async function ensureBrandHasFinsCategory(
  supabase: SupabaseClient,
  brandId: string,
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("brand_product_categories")
    .select("category_slug")
    .eq("brand_id", brandId)
    .eq("category_slug", FIN_CATALOG_PRODUCT_CATEGORY)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to check brand fins category: ${selectError.message}`)
  }
  if (existing) return

  const { error: insertError } = await supabase.from("brand_product_categories").insert({
    brand_id: brandId,
    category_slug: FIN_CATALOG_PRODUCT_CATEGORY,
  })

  if (insertError && insertError.code !== "23505") {
    throw new Error(`Failed to tag brand with fins category: ${insertError.message}`)
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
    .eq("product_category_slug", FIN_CATALOG_PRODUCT_CATEGORY)
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
  const brandId = await resolveBrandId(supabase)
  const rows = loadFirewireFinJsonRows(jsonPath)

  console.log(
    JSON.stringify(
      {
        brandId,
        brandSlug: FIREWIRE_FINS_BRAND_SLUG,
        productCategory: FIN_CATALOG_PRODUCT_CATEGORY,
        jsonPath,
        dryRun,
        productCount: rows.length,
        estimatedVariants: rows.reduce((n, r) => n + buildFirewireFinVariantDrafts(r).length, 0),
      },
      null,
      2,
    ),
  )

  if (!dryRun) {
    await ensureBrandHasFinsCategory(supabase, brandId)
  }

  let modelsCreated = 0
  let modelsMerged = 0
  let variantsCreated = 0
  let skippedModels = 0
  let skippedVariants = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const row of rows) {
    const description = buildFirewireFinModelDescription(row)
    const variants = buildFirewireFinVariantDrafts(row)

    if (dryRun) {
      modelsCreated++
      variantsCreated += variants.length
      console.log(
        JSON.stringify(
          {
            name: row.productName,
            productCategory: FIN_CATALOG_PRODUCT_CATEGORY,
            variantCount: variants.length,
            variants: variants.map((v) => ({
              fin_box_type: v.fin_box_type,
              fin_boxes: v.fin_boxes,
              configuration_label: v.configuration_label,
              price: v.price,
            })),
          },
          null,
          2,
        ),
      )
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: resolveFirewireFinModelImage(row.productImages),
      kind: "model",
      logLabel: "import firewire fins",
    })

    const modelResult = await insertBrandModel(supabase, {
      brand_id: brandId,
      name: row.productName,
      description,
      image_url: modelImageUrl,
      product_category_slug: FIN_CATALOG_PRODUCT_CATEGORY,
      board_category_slug: null,
    })

    let modelId: string

    if (!modelResult.ok) {
      if (modelResult.code === "23505") {
        const existingId = await getBrandModelIdByName(supabase, brandId, row.productName)
        if (!existingId) {
          skippedModels++
          errors.push(`Model exists but fins lookup failed: ${row.productName}`)
          continue
        }
        modelId = existingId
        modelsMerged++
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
      const variantImageUrl =
        (await resolveMirroredBrandCatalogImageUrl({
          cache: imageCache,
          supabase,
          supabaseUrl,
          sourceUrl: preferFirewireFinProductImageUrl(variant.image_url ?? "") || null,
          kind: "variant",
          logLabel: "import firewire fins",
        })) ?? modelImageUrl

      const variantResult = await insertBrandModelVariant(supabase, {
        brand_id: brandId,
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
        fin_color_label: variant.fin_color_label,
        product_category_slug: FIN_CATALOG_PRODUCT_CATEGORY,
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
        modelsMerged,
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
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_FIREWIRE_FIN_JSON

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
