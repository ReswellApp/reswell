/**
 * Mirror external brand logo URLs into Supabase `brand-assets` and update `brands.logo_url`.
 *
 * Usage:
 *   npx tsx scripts/backfill-brand-logo-urls.ts [--dry-run] [--slug=<slug>]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { isSelfHostedBrandLogoUrl } from "@/lib/brand-media-proxy-url"
import {
  createBrandCatalogImageMirrorCache,
  isExternalBrandCatalogImageUrl,
} from "@/lib/services/brandCatalogImageStorage"

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

function parseArgs(argv: string[]): { dryRun: boolean; slug: string | null } {
  let dryRun = false
  let slug: string | null = null
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true
    else if (arg.startsWith("--slug=")) slug = arg.slice("--slug=".length).trim() || null
  }
  return { dryRun, slug }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const { dryRun, slug } = parseArgs(process.argv.slice(2))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(supabaseUrl, key)
  const cache = createBrandCatalogImageMirrorCache()

  let query = supabase.from("brands").select("id, slug, name, logo_url").order("name")
  if (slug) query = query.eq("slug", slug)

  const { data: brands, error } = await query
  if (error) throw new Error(error.message)

  const external = (brands ?? []).filter(
    (row) => row.logo_url?.trim() && !isSelfHostedBrandLogoUrl(row.logo_url),
  )

  console.log(`Found ${external.length} brand(s) with external logo URLs${dryRun ? " (dry run)" : ""}\n`)

  let mirrored = 0
  let failed = 0
  let skipped = 0

  for (const brand of external) {
    const sourceUrl = brand.logo_url!.trim()
    if (!isExternalBrandCatalogImageUrl(sourceUrl)) {
      console.log(`⏭  ${brand.slug}: not a mirrorable HTTP image URL`)
      skipped += 1
      continue
    }

    if (dryRun) {
      console.log(`🔍 ${brand.slug}: would mirror ${sourceUrl}`)
      mirrored += 1
      continue
    }

    const result = await cache.mirror({
      supabase,
      supabaseUrl,
      sourceUrl,
      kind: "logo",
    })

    if (!result.ok) {
      console.error(`❌ ${brand.slug}: ${result.error}`)
      failed += 1
      continue
    }

    const { error: updateError } = await supabase
      .from("brands")
      .update({ logo_url: result.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", brand.id)

    if (updateError) {
      console.error(`❌ ${brand.slug}: uploaded but DB update failed — ${updateError.message}`)
      failed += 1
      continue
    }

    console.log(`✅ ${brand.slug}: ${result.skipped === "already_mirrored" ? "already mirrored" : "mirrored"}`)
    mirrored += 1
  }

  console.log(`\nDone. Mirrored: ${mirrored}, failed: ${failed}, skipped: ${skipped}`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
