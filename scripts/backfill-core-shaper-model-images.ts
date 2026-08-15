/**
 * Backfill `brand_models.image_url` for core shaper models that imported without photos.
 * Mirrors remote images into Supabase `brand-assets`.
 *
 * Usage:
 *   npx tsx scripts/backfill-core-shaper-model-images.ts [--dry-run]
 *     [--seed scripts/data/surfboard-catalog-seed/core-shapers-image-backfill.json]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  createBrandCatalogImageMirrorCache,
  resolveMirroredBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"

type BackfillModel = {
  id: string
  name: string
  image_url: string
}

type BackfillBrand = {
  slug: string
  models: BackfillModel[]
}

type BackfillFile = {
  brands: BackfillBrand[]
}

const DEFAULT_SEED = resolve(
  process.cwd(),
  "scripts/data/surfboard-catalog-seed/core-shapers-image-backfill.json",
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
    // optional
  }
}

/** Prior cloud-agent secret names used title case. */
function resolveSupabaseEnv(): { url: string; key: string } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.Next_Public_Supabase_Url?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.Supabase_Service_Role_Key?.trim() ||
    ""
  // Prefer known production host if a non-URL placeholder was stored under the public key name.
  const resolvedUrl = /^https?:\/\//i.test(url)
    ? url
    : "https://lqwsewptsirsglasnwmn.supabase.co"
  return { url: resolvedUrl, key }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const seedIdx = args.indexOf("--seed")
  const seedPath =
    seedIdx >= 0 && args[seedIdx + 1] ? resolve(args[seedIdx + 1]) : DEFAULT_SEED

  const { url, key } = resolveSupabaseEnv()
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or Supabase_Service_Role_Key)")
  }

  const payload = JSON.parse(readFileSync(seedPath, "utf8")) as BackfillFile
  const brands = payload.brands ?? []
  const modelCount = brands.reduce((n, b) => n + b.models.length, 0)

  console.log(
    JSON.stringify(
      {
        dryRun,
        seedPath,
        brandCount: brands.length,
        modelCount,
        supabaseUrl: url,
        serviceRoleLen: key.length,
      },
      null,
      2,
    ),
  )

  if (dryRun) {
    for (const brand of brands) {
      console.log(
        JSON.stringify({
          slug: brand.slug,
          models: brand.models.map((m) => ({ name: m.name, image: m.image_url.slice(0, 80) })),
        }),
      )
    }
    return
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const imageCache = createBrandCatalogImageMirrorCache()

  let updated = 0
  let skipped = 0
  let mirrorFailed = 0
  const errors: string[] = []

  for (const brand of brands) {
    for (const model of brand.models) {
      const mirrored = await resolveMirroredBrandCatalogImageUrl({
        cache: imageCache,
        supabase,
        supabaseUrl: url,
        sourceUrl: model.image_url,
        kind: "model",
        logLabel: `backfill images (${brand.slug})`,
      })

      if (!mirrored) {
        mirrorFailed++
        errors.push(`${brand.slug}/${model.name}: mirror failed`)
        continue
      }

      const { data: existing, error: existingError } = await supabase
        .from("brand_models")
        .select("id, image_url")
        .eq("id", model.id)
        .maybeSingle()

      if (existingError || !existing?.id) {
        skipped++
        errors.push(`${brand.slug}/${model.name}: model id not found`)
        continue
      }

      if (existing.image_url) {
        skipped++
        continue
      }

      const { error: updateError } = await supabase
        .from("brand_models")
        .update({ image_url: mirrored, updated_at: new Date().toISOString() })
        .eq("id", model.id)

      if (updateError) {
        errors.push(`${brand.slug}/${model.name}: ${updateError.message}`)
        continue
      }

      updated++
    }

    console.log(JSON.stringify({ brand: brand.slug, models: brand.models.length }))
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        updated,
        skipped,
        mirrorFailed,
        errorCount: errors.length,
        errors: errors.slice(0, 40),
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
