/**
 * Bulk import Sharp Eye surfboard catalog from Thunderbit JSON export.
 * Creates one brand model per shape, with material builds as variants underneath.
 *
 * Usage:
 *   npx tsx scripts/import-sharpeye-catalog.ts [--dry-run] [json-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel } from "@/lib/db/brand-models"
import { insertBrandModelVariant, maxSortOrderForBrandModel } from "@/lib/db/brand-model-variants"
import type { BrandModelVariantMaterial } from "@/lib/validations/brand-model-variants"
import {
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOX_TYPE,
} from "@/lib/validations/brand-model-variants"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"
import {
  DEFAULT_SHARP_EYE_JSON,
  groupSharpEyeJsonRows,
  loadSharpEyeJsonRows,
  SHARP_EYE_BRAND_SLUG,
} from "@/lib/services/sharpEyeSurfboardCatalogJson"

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
    .eq("slug", SHARP_EYE_BRAND_SLUG)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Brand not found for slug "${SHARP_EYE_BRAND_SLUG}"`)
  }
  return data.id
}

async function resolveModelId(
  supabase: SupabaseClient,
  brandId: string,
  baseName: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("brand_models")
    .select("id")
    .eq("brand_id", brandId)
    .ilike("name", baseName.trim())
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function upsertMaterialVariant(
  supabase: SupabaseClient,
  supabaseUrl: string,
  cache: ReturnType<typeof createBrandCatalogImageMirrorCache>,
  brandId: string,
  modelId: string,
  variant: {
    materialLabel: string
    material: BrandModelVariantMaterial
    imageUrl: string | null
  },
  sortOrder: number,
): Promise<"created" | "updated" | "skipped" | "failed"> {
  const mirroredImageUrl = await resolveMirroredBrandCatalogImageUrl({
    cache,
    supabase,
    supabaseUrl,
    sourceUrl: variant.imageUrl,
    kind: "variant",
    logLabel: "import sharp eye",
  })

  const insertResult = await insertBrandModelVariant(supabase, {
    brand_id: brandId,
    brand_model_id: modelId,
    length_label: "",
    width_label: "",
    thickness_label: "",
    volume_label: "",
    fin_box_type: BRAND_MODEL_VARIANT_DEFAULT_FIN_BOX_TYPE,
    fin_boxes: BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
    material: variant.material,
    condition: "brand_new",
    configuration_label: variant.materialLabel,
    product_category_slug: "surfboards",
    price: null,
    image_url: mirroredImageUrl,
    sort_order: sortOrder,
  })

  if (insertResult.ok) return "created"

  if (insertResult.code === "23505") {
    const { data: existing, error } = await supabase
      .from("brand_model_variants")
      .select("id")
      .eq("brand_model_id", modelId)
      .eq("material", variant.material)
      .eq("condition", "brand_new")
      .eq("length_label", "")
      .eq("width_label", "")
      .eq("thickness_label", "")
      .eq("volume_label", "")
      .maybeSingle()

    if (error || !existing?.id) return "skipped"

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      configuration_label: variant.materialLabel,
    }
    if (mirroredImageUrl) {
      updates.image_url = mirroredImageUrl
    }

    const { error: updateError } = await supabase
      .from("brand_model_variants")
      .update(updates)
      .eq("id", existing.id)

    return updateError ? "failed" : "updated"
  }

  return "failed"
}

async function importCatalog(
  supabase: SupabaseClient,
  supabaseUrl: string,
  jsonPath: string,
  dryRun: boolean,
): Promise<void> {
  const brandId = await resolveBrandId(supabase)
  const grouped = groupSharpEyeJsonRows(loadSharpEyeJsonRows(jsonPath))

  console.log(
    JSON.stringify(
      {
        brandId,
        brandSlug: SHARP_EYE_BRAND_SLUG,
        jsonPath,
        dryRun,
        modelCount: grouped.length,
        variantCount: grouped.reduce((n, g) => n + g.variants.length, 0),
      },
      null,
      2,
    ),
  )

  let modelsCreated = 0
  let modelsUpdated = 0
  let variantsCreated = 0
  let variantsUpdated = 0
  let skippedVariants = 0
  const errors: string[] = []
  const imageCache = createBrandCatalogImageMirrorCache()

  for (const group of grouped) {
    if (dryRun) {
      modelsCreated++
      variantsCreated += group.variants.length
      continue
    }

    const modelImageUrl = await resolveMirroredBrandCatalogImageUrl({
      cache: imageCache,
      supabase,
      supabaseUrl,
      sourceUrl: group.modelImageUrl,
      kind: "model",
      logLabel: "import sharp eye",
    })

    let modelId = await resolveModelId(supabase, brandId, group.baseName)

    if (!modelId) {
      const modelResult = await insertBrandModel(supabase, {
        brand_id: brandId,
        name: group.baseName,
        description: group.description,
        image_url: modelImageUrl,
        product_category_slug: "surfboards",
      })

      if (!modelResult.ok) {
        errors.push(`Model failed (${group.baseName}): ${modelResult.error}`)
        continue
      }

      modelsCreated++
      modelId = modelResult.row.id
    } else {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (group.description) updates.description = group.description
      if (modelImageUrl) updates.image_url = modelImageUrl

      const { error: updateError } = await supabase
        .from("brand_models")
        .update(updates)
        .eq("id", modelId)

      if (updateError) {
        errors.push(`Model update failed (${group.baseName}): ${updateError.message}`)
        continue
      }

      modelsUpdated++
    }

    let sortOrder = await maxSortOrderForBrandModel(supabase, modelId)

    for (const variant of group.variants) {
      sortOrder += 1
      const result = await upsertMaterialVariant(
        supabase,
        supabaseUrl,
        imageCache,
        brandId,
        modelId,
        variant,
        sortOrder,
      )

      if (result === "created") variantsCreated++
      else if (result === "updated") variantsUpdated++
      else if (result === "skipped") skippedVariants++
      else {
        errors.push(`Variant failed (${group.baseName} / ${variant.materialLabel})`)
      }
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
        modelsUpdated,
        variantsCreated,
        variantsUpdated,
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
  const jsonPath = jsonArg ? resolve(jsonArg) : DEFAULT_SHARP_EYE_JSON

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
