/**
 * Mirror True Ames fin catalog images from external CDNs into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/migrate-true-ames-catalog-images.ts [--dry-run] [--force-csv] [csv-path]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { updateBrandModel } from "@/lib/db/brand-models"
import { updateBrandModelVariant } from "@/lib/db/brand-model-variants"
import {
  createBrandCatalogImageMirrorCache,
  extractFirstHttpImageUrl,
  isBrandCatalogImageMirrored,
  isExternalBrandCatalogImageUrl,
  isValidHttpImageSource,
  type BrandCatalogImageKind,
} from "@/lib/services/brandCatalogImageStorage"
import { isFinCatalogSwatchImageUrl } from "@/lib/utils/fin-catalog-display-image"
import {
  DEFAULT_TRUE_AMES_FIN_CSV,
  loadTrueAmesFinCsvByProductName,
  preferFullProductImageUrl,
  resolveTrueAmesModelImageFromCsv,
  resolveTrueAmesVariantImageFromCsv,
} from "@/lib/services/trueAmesFinCatalogCsv"

const TRUE_AMES_BRAND_ID = "045c41b8-ea77-4f98-8cb2-833a10b722ed"

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

async function mirrorUrl(
  cache: ReturnType<typeof createBrandCatalogImageMirrorCache>,
  supabase: SupabaseClient,
  supabaseUrl: string,
  sourceUrl: string,
  kind: BrandCatalogImageKind,
  dryRun: boolean,
): Promise<{ url: string; mirrored: boolean; error?: string }> {
  if (!isValidHttpImageSource(sourceUrl)) {
    return { url: sourceUrl.trim(), mirrored: false, error: "Invalid source URL" }
  }

  if (!isExternalBrandCatalogImageUrl(sourceUrl)) {
    return { url: sourceUrl.trim(), mirrored: false }
  }

  if (dryRun) {
    return { url: sourceUrl.trim(), mirrored: true }
  }

  const result = await cache.mirror({ supabase, supabaseUrl, sourceUrl, kind })
  if (!result.ok) {
    return { url: sourceUrl.trim(), mirrored: false, error: result.error }
  }
  return { url: result.publicUrl, mirrored: result.skipped === "uploaded" }
}

async function migrate(dryRun: boolean, csvPath: string, forceCsv: boolean): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(supabaseUrl, key)
  const cache = createBrandCatalogImageMirrorCache()
  const csvByName = loadTrueAmesFinCsvByProductName(csvPath)

  const { data: models, error: modelsErr } = await supabase
    .from("brand_models")
    .select("id, name, image_url")
    .eq("brand_id", TRUE_AMES_BRAND_ID)
    .order("name")

  if (modelsErr) throw new Error(modelsErr.message)

  const { data: variants, error: variantsErr } = await supabase
    .from("brand_model_variants")
    .select("id, brand_model_id, image_url, fin_color_label")
    .eq("brand_id", TRUE_AMES_BRAND_ID)

  if (variantsErr) throw new Error(variantsErr.message)

  let modelsRepaired = 0
  let variantsRepaired = 0
  let modelsUpdated = 0
  let variantsUpdated = 0
  let modelsMirrored = 0
  let variantsMirrored = 0
  let modelsSkipped = 0
  let variantsSkipped = 0
  const errors: string[] = []

  const modelImageById = new Map<string, string | null>()

  for (const model of models ?? []) {
    const csvRow = csvByName.get(model.name.trim())
    let current = model.image_url?.trim() ?? ""

    if (csvRow && (!isValidHttpImageSource(current) || isExternalBrandCatalogImageUrl(current))) {
      const repaired = resolveTrueAmesModelImageFromCsv(csvRow)
      if (repaired && repaired !== current) {
        current = repaired
        modelsRepaired++
        if (!dryRun) {
          const updated = await updateBrandModel(supabase, model.id, { image_url: repaired })
          if (!updated.ok) {
            errors.push(`Model repair (${model.name}): ${updated.error}`)
          }
        }
      }
    }

    modelImageById.set(model.id, current || null)

    if (!current) continue

    if (!isExternalBrandCatalogImageUrl(current)) {
      if (isBrandCatalogImageMirrored(current)) modelsSkipped++
      continue
    }

    const { url, mirrored, error } = await mirrorUrl(
      cache,
      supabase,
      supabaseUrl,
      current,
      "model",
      dryRun,
    )
    if (error) {
      errors.push(`Model image (${model.name}): ${error}`)
      continue
    }
    if (mirrored) modelsMirrored++

    if (!dryRun && url !== current) {
      const updated = await updateBrandModel(supabase, model.id, { image_url: url })
      if (!updated.ok) {
        errors.push(`Model update (${model.name}): ${updated.error}`)
        continue
      }
      modelImageById.set(model.id, url)
      modelsUpdated++
    } else if (dryRun && isExternalBrandCatalogImageUrl(current)) {
      modelsUpdated++
    }
  }

  const modelNameById = new Map((models ?? []).map((m) => [m.id, m.name]))

  let swatchVariantsReplaced = 0
  for (const variant of variants ?? []) {
    if (!isFinCatalogSwatchImageUrl(variant.image_url)) continue
    const modelImage = modelImageById.get(variant.brand_model_id)
    if (!modelImage || modelImage === variant.image_url?.trim()) continue
    variant.image_url = modelImage
    swatchVariantsReplaced++
    if (!dryRun) {
      await updateBrandModelVariant(supabase, variant.id, { image_url: modelImage })
    }
  }

  for (const variant of variants ?? []) {
    const modelName = modelNameById.get(variant.brand_model_id) ?? variant.brand_model_id
    const csvRow = csvByName.get(modelName.trim())
    let current = variant.image_url?.trim() ?? ""

    const extracted = extractFirstHttpImageUrl(current)
    if (extracted) current = preferFullProductImageUrl(extracted)

    const needsRepair =
      forceCsv ||
      !isValidHttpImageSource(current) ||
      isExternalBrandCatalogImageUrl(current) ||
      /_50x/i.test(current)

    if (csvRow && needsRepair) {
      const repaired =
        resolveTrueAmesVariantImageFromCsv(csvRow, variant.fin_color_label ?? "") ?? null
      if (repaired && (forceCsv || repaired !== current)) {
        current = repaired
        variantsRepaired++
        if (!dryRun) {
          const updated = await updateBrandModelVariant(supabase, variant.id, { image_url: repaired })
          if (!updated.ok) {
            errors.push(`Variant repair (${modelName}): ${updated.error}`)
          }
        }
      }
    }

    if (!isValidHttpImageSource(current)) {
      const modelFallback = modelImageById.get(variant.brand_model_id)
      if (modelFallback && isValidHttpImageSource(modelFallback)) {
        current = modelFallback
        variantsRepaired++
      }
    }

    if (!current) continue

    if (!isExternalBrandCatalogImageUrl(current)) {
      if (isBrandCatalogImageMirrored(current)) {
        variantsSkipped++
        if (!dryRun && current !== variant.image_url?.trim()) {
          const updated = await updateBrandModelVariant(supabase, variant.id, { image_url: current })
          if (updated.ok) variantsUpdated++
        }
        continue
      }
      continue
    }

    const { url, mirrored, error } = await mirrorUrl(
      cache,
      supabase,
      supabaseUrl,
      current,
      "variant",
      dryRun,
    )
    if (error) {
      const fallback = modelImageById.get(variant.brand_model_id)
      if (fallback && isBrandCatalogImageMirrored(fallback)) {
        if (!dryRun) {
          const updated = await updateBrandModelVariant(supabase, variant.id, { image_url: fallback })
          if (updated.ok) variantsUpdated++
        }
        continue
      }
      errors.push(`Variant image (${modelName}): ${error}`)
      continue
    }
    if (mirrored) variantsMirrored++

    if (!dryRun && url !== current) {
      const updated = await updateBrandModelVariant(supabase, variant.id, { image_url: url })
      if (!updated.ok) {
        errors.push(`Variant update (${modelName}): ${updated.error}`)
        continue
      }
      variantsUpdated++
    } else if (dryRun && isExternalBrandCatalogImageUrl(current)) {
      variantsUpdated++
    }
  }

  const { count: externalModelsLeft } = await supabase
    .from("brand_models")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", TRUE_AMES_BRAND_ID)
    .or("image_url.ilike.%shopify%,image_url.ilike.%trueames%")

  const { count: externalVariantsLeft } = await supabase
    .from("brand_model_variants")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", TRUE_AMES_BRAND_ID)
    .or("image_url.ilike.%shopify%,image_url.ilike.%trueames%")

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        csvPath,
        brandId: TRUE_AMES_BRAND_ID,
        modelsTotal: models?.length ?? 0,
        variantsTotal: variants?.length ?? 0,
        modelsRepaired,
        variantsRepaired,
        modelsUpdated,
        variantsUpdated,
        modelsMirrored,
        variantsMirrored,
        modelsAlreadyMirrored: modelsSkipped,
        variantsAlreadyMirrored: variantsSkipped,
        swatchVariantsReplaced,
        externalModelsLeft,
        externalVariantsLeft,
        errorCount: errors.length,
        errors: errors.slice(0, 30),
      },
      null,
      2,
    ),
  )
}

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const forceCsv = args.includes("--force-csv")
const csvArg = args.find((a) => !a.startsWith("--"))
const csvPath = csvArg ? resolve(csvArg) : DEFAULT_TRUE_AMES_FIN_CSV

migrate(dryRun, csvPath, forceCsv).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
