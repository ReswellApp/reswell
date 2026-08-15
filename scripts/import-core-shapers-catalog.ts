/**
 * Bulk import ~50 small/core surfboard shapers into `brands` + `brand_models`.
 * Mirrors remote product images into Supabase `brand-assets`.
 * Also backfills models for existing empty shaper brands when seed files are present.
 *
 * Usage:
 *   npx tsx scripts/import-core-shapers-catalog.ts [--dry-run] [--skip-images]
 *     [--seed scripts/data/surfboard-catalog-seed/core-shapers-50.json]
 *     [--backfill scripts/data/surfboard-catalog-seed/existing-empty-shapers-backfill.json]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModel, updateBrandModel } from "@/lib/db/brand-models"
import { syncBrandProductCategories } from "@/lib/db/brand-product-categories"
import { isValidBrandSlug, slugifyBrandName } from "@/lib/brands/slug"
import { syncBrandToIndex } from "@/lib/elasticsearch/brands-index"
import { syncSellCatalogBrandToIndex } from "@/lib/elasticsearch/sell-catalog-index"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"

type SeedModel = {
  name: string
  image_url?: string | null
  description?: string | null
}

type SeedBrand = {
  slug: string
  name: string
  website_url?: string | null
  location_label?: string | null
  founder_name?: string | null
  lead_shaper_name?: string | null
  short_description?: string | null
  logo_url?: string | null
  models: SeedModel[]
}

type SeedFile = {
  product_category_slug?: string
  brands: SeedBrand[]
}

const DEFAULT_SEED = resolve(
  process.cwd(),
  "scripts/data/surfboard-catalog-seed/core-shapers-50.json",
)
const DEFAULT_BACKFILL = resolve(
  process.cwd(),
  "scripts/data/surfboard-catalog-seed/existing-empty-shapers-backfill.json",
)

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

function loadSeedFile(path: string): SeedBrand[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as SeedFile | SeedBrand[]
  const brands = Array.isArray(raw) ? raw : raw.brands
  if (!Array.isArray(brands)) {
    throw new Error(`Invalid seed file (expected brands array): ${path}`)
  }
  return brands
    .map((b) => ({
      ...b,
      slug: (b.slug || slugifyBrandName(b.name)).trim(),
      name: b.name.trim(),
      models: (b.models ?? [])
        .map((m) => ({
          name: m.name.trim(),
          image_url: m.image_url ?? null,
          description: m.description ?? null,
        }))
        .filter((m) => m.name.length > 0),
    }))
    .filter((b) => b.name.length > 0 && isValidBrandSlug(b.slug))
}

function loadBackfillFile(path: string): Map<string, SeedModel[]> {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, SeedModel[]>
    const out = new Map<string, SeedModel[]>()
    for (const [slug, models] of Object.entries(raw)) {
      if (!Array.isArray(models)) continue
      out.set(
        slug,
        models
          .map((m) => ({
            name: (m.name ?? "").trim(),
            image_url: m.image_url ?? null,
            description: m.description ?? null,
          }))
          .filter((m) => m.name.length > 0),
      )
    }
    return out
  } catch {
    return new Map()
  }
}

async function ensureBrand(
  supabase: SupabaseClient,
  brand: SeedBrand,
  dryRun: boolean,
): Promise<{ id: string; created: boolean }> {
  const { data: existing, error } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brand.slug)
    .maybeSingle()

  if (error) {
    throw new Error(`Brand lookup failed (${brand.slug}): ${error.message}`)
  }

  if (existing?.id) {
    if (!dryRun) {
      await supabase
        .from("brands")
        .update({
          name: brand.name,
          short_description: brand.short_description ?? null,
          website_url: brand.website_url ?? null,
          founder_name: brand.founder_name ?? null,
          lead_shaper_name: brand.lead_shaper_name ?? null,
          location_label: brand.location_label ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      await syncBrandProductCategories(supabase, existing.id, ["surfboards"])
    }
    return { id: existing.id, created: false }
  }

  if (dryRun) {
    return { id: `dry-run-${brand.slug}`, created: true }
  }

  const now = new Date().toISOString()
  const { data, error: insertError } = await supabase
    .from("brands")
    .insert({
      slug: brand.slug,
      name: brand.name,
      short_description: brand.short_description ?? null,
      website_url: brand.website_url ?? null,
      logo_url: brand.logo_url ?? null,
      founder_name: brand.founder_name ?? null,
      lead_shaper_name: brand.lead_shaper_name ?? null,
      location_label: brand.location_label ?? null,
      model_count: 0,
      about_paragraphs: [],
      updated_at: now,
    })
    .select("id")
    .single()

  if (insertError || !data?.id) {
    throw new Error(
      `Brand insert failed (${brand.slug}): ${insertError?.message ?? "no id"}`,
    )
  }

  const categorySync = await syncBrandProductCategories(supabase, data.id, ["surfboards"])
  if (!categorySync.ok) {
    await supabase.from("brands").delete().eq("id", data.id)
    throw new Error(`Brand category sync failed (${brand.slug}): ${categorySync.error}`)
  }

  return { id: data.id, created: true }
}

async function upsertModelsForBrand(opts: {
  supabase: SupabaseClient
  supabaseUrl: string
  brandId: string
  brandSlug: string
  models: SeedModel[]
  dryRun: boolean
  skipImages: boolean
  imageCache: ReturnType<typeof createBrandCatalogImageMirrorCache>
}): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  let created = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const model of opts.models) {
    if (opts.dryRun) {
      created++
      continue
    }

    let imageUrl: string | null = null
    if (!opts.skipImages && model.image_url) {
      imageUrl = await resolveMirroredBrandCatalogImageUrl({
        cache: opts.imageCache,
        supabase: opts.supabase,
        supabaseUrl: opts.supabaseUrl,
        sourceUrl: model.image_url,
        kind: "model",
        logLabel: `import core shapers (${opts.brandSlug})`,
      })
    }

    const insertResult = await insertBrandModel(opts.supabase, {
      brand_id: opts.brandId,
      name: model.name,
      description: model.description ?? null,
      image_url: imageUrl,
      product_category_slug: "surfboards",
    })

    if (insertResult.ok) {
      created++
      continue
    }

    if (insertResult.code === "23505") {
      const { data: existing, error: existingError } = await opts.supabase
        .from("brand_models")
        .select("id, description, image_url")
        .eq("brand_id", opts.brandId)
        .ilike("name", model.name)
        .maybeSingle()

      if (existingError || !existing?.id) {
        skipped++
        errors.push(`${opts.brandSlug}/${model.name}: exists but id unresolved`)
        continue
      }

      const patch: {
        description?: string | null
        image_url?: string | null
      } = {}
      if (model.description && !existing.description) {
        patch.description = model.description
      }
      if (imageUrl && !existing.image_url) {
        patch.image_url = imageUrl
      }

      if (Object.keys(patch).length > 0) {
        const updateResult = await updateBrandModel(opts.supabase, existing.id, patch)
        if (!updateResult.ok) {
          errors.push(`${opts.brandSlug}/${model.name}: ${updateResult.error}`)
          skipped++
        } else {
          updated++
        }
      } else {
        skipped++
      }
      continue
    }

    errors.push(`${opts.brandSlug}/${model.name}: ${insertResult.error}`)
  }

  return { created, updated, skipped, errors }
}

async function refreshModelCount(supabase: SupabaseClient, brandId: string): Promise<number> {
  const { count, error } = await supabase
    .from("brand_models")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)

  if (error || count == null) return 0
  await supabase.from("brands").update({ model_count: count }).eq("id", brandId)
  return count
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const skipImages = args.includes("--skip-images")
  const seedArgIdx = args.indexOf("--seed")
  const backfillArgIdx = args.indexOf("--backfill")
  const seedPath =
    seedArgIdx >= 0 && args[seedArgIdx + 1] ? resolve(args[seedArgIdx + 1]) : DEFAULT_SEED
  const backfillPath =
    backfillArgIdx >= 0 && args[backfillArgIdx + 1]
      ? resolve(args[backfillArgIdx + 1])
      : DEFAULT_BACKFILL

  const urlCandidate =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.Next_Public_Supabase_Url?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  // Prefer known production host if a non-URL placeholder was stored under the public key name.
  const url = /^https?:\/\//i.test(urlCandidate)
    ? urlCandidate
    : "https://lqwsewptsirsglasnwmn.supabase.co"
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.Supabase_Service_Role_Key?.trim() ||
    ""
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (or Supabase_Service_Role_Key)",
    )
  }

  const brands = loadSeedFile(seedPath)
  const backfill = loadBackfillFile(backfillPath)
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const imageCache = createBrandCatalogImageMirrorCache()

  console.log(
    JSON.stringify(
      {
        dryRun,
        skipImages,
        seedPath,
        backfillPath,
        brandCount: brands.length,
        modelCount: brands.reduce((n, b) => n + b.models.length, 0),
        backfillBrandCount: backfill.size,
      },
      null,
      2,
    ),
  )

  let brandsCreated = 0
  let brandsExisting = 0
  let modelsCreated = 0
  let modelsUpdated = 0
  let modelsSkipped = 0
  const errors: string[] = []

  for (const brand of brands) {
    try {
      const ensured = await ensureBrand(supabase, brand, dryRun)
      if (ensured.created) brandsCreated++
      else brandsExisting++

      const result = await upsertModelsForBrand({
        supabase,
        supabaseUrl: url,
        brandId: ensured.id,
        brandSlug: brand.slug,
        models: brand.models,
        dryRun,
        skipImages,
        imageCache,
      })
      modelsCreated += result.created
      modelsUpdated += result.updated
      modelsSkipped += result.skipped
      errors.push(...result.errors)

      if (!dryRun) {
        await refreshModelCount(supabase, ensured.id)
        void syncBrandToIndex(supabase, ensured.id)
        void syncSellCatalogBrandToIndex(supabase, ensured.id)
      }

      console.log(
        JSON.stringify({
          brand: brand.slug,
          created: ensured.created,
          models: brand.models.length,
          modelsCreated: result.created,
          modelsUpdated: result.updated,
        }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${brand.slug}: ${message}`)
      console.error(message)
    }
  }

  for (const [slug, models] of backfill) {
    if (models.length === 0) continue
    const { data: existing, error } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (error || !existing?.id) {
      errors.push(`backfill ${slug}: brand not found`)
      continue
    }

    if (!dryRun) {
      await syncBrandProductCategories(supabase, existing.id, ["surfboards"])
    }

    const result = await upsertModelsForBrand({
      supabase,
      supabaseUrl: url,
      brandId: existing.id,
      brandSlug: slug,
      models,
      dryRun,
      skipImages,
      imageCache,
    })
    modelsCreated += result.created
    modelsUpdated += result.updated
    modelsSkipped += result.skipped
    errors.push(...result.errors)

    if (!dryRun) {
      await refreshModelCount(supabase, existing.id)
      void syncBrandToIndex(supabase, existing.id)
      void syncSellCatalogBrandToIndex(supabase, existing.id)
    }

    console.log(
      JSON.stringify({
        backfill: slug,
        models: models.length,
        modelsCreated: result.created,
        modelsUpdated: result.updated,
      }),
    )
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        dryRun,
        brandsCreated,
        brandsExisting,
        modelsCreated,
        modelsUpdated,
        modelsSkipped,
        errorCount: errors.length,
        errors: errors.slice(0, 50),
      },
      null,
      2,
    ),
  )

  if (errors.length > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
