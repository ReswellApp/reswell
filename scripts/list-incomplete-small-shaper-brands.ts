/**
 * List existing surfboard brands that look like incomplete small shapers.
 * Used by the small-shaper catalog automation to pick the next brand.
 *
 *   npx tsx scripts/list-incomplete-small-shaper-brands.ts
 *   npx tsx scripts/list-incomplete-small-shaper-brands.ts --limit 20 --max-models 8
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

type SkipFile = {
  major_factory_or_global?: string[]
  not_a_surfboard_shaper?: string[]
}

type Candidate = {
  slug: string
  name: string
  website_url: string
  model_count: number
  location_label: string | null
}

const SKIP_PATH = resolve(
  process.cwd(),
  "scripts/data/surfboard-catalog-seed/small-shaper-catalog-skip-slugs.json",
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

function supabaseUrl(): string {
  const urlCandidate =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.Next_Public_Supabase_Url?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  if (/^https?:\/\//i.test(urlCandidate) && !/app\.reswell\.app/i.test(urlCandidate)) {
    return urlCandidate
  }
  return "https://lqwsewptsirsglasnwmn.supabase.co"
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function isOfficialCatalogWebsite(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase()
    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "facebook.com" ||
      host.endsWith(".facebook.com") ||
      host === "x.com" ||
      host === "twitter.com" ||
      host === "tiktok.com" ||
      host.endsWith(".tiktok.com") ||
      host === "surfindustries.com" ||
      host.endsWith(".surfindustries.com") ||
      host === "amazon.com" ||
      host.endsWith(".amazon.com")
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const args = process.argv.slice(2)
  const limitIdx = args.indexOf("--limit")
  const maxModelsIdx = args.indexOf("--max-models")
  const limit = parsePositiveInt(limitIdx >= 0 ? args[limitIdx + 1] : undefined, 15)
  const maxModels = parsePositiveInt(
    maxModelsIdx >= 0 ? args[maxModelsIdx + 1] : undefined,
    8,
  )

  const skipRaw = JSON.parse(readFileSync(SKIP_PATH, "utf8")) as SkipFile
  const skip = new Set(
    [...(skipRaw.major_factory_or_global ?? []), ...(skipRaw.not_a_surfboard_shaper ?? [])].map(
      (s) => s.trim().toLowerCase(),
    ),
  )

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.Supabase_Service_Role_Key?.trim() ||
    ""
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (or Supabase_Service_Role_Key)")
  }

  const supabase = createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: catRows, error: catError } = await supabase
    .from("brand_product_categories")
    .select("brand_id")
    .eq("category_slug", "surfboards")
  if (catError) throw new Error(`category lookup failed: ${catError.message}`)

  const brandIds = [...new Set((catRows ?? []).map((row) => String(row.brand_id)))]
  if (brandIds.length === 0) {
    console.log(JSON.stringify({ maxModels, limit, candidates: [] }, null, 2))
    return
  }

  const brands: {
    slug: string
    name: string
    website_url: string | null
    model_count: number | null
    location_label: string | null
  }[] = []

  const chunkSize = 200
  for (let i = 0; i < brandIds.length; i += chunkSize) {
    const chunk = brandIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from("brands")
      .select("slug, name, website_url, model_count, location_label")
      .in("id", chunk)
    if (error) throw new Error(`brand lookup failed: ${error.message}`)
    brands.push(...((data ?? []) as typeof brands))
  }

  const candidates: Candidate[] = brands
    .filter((b) => {
      const slug = b.slug.trim().toLowerCase()
      const website = b.website_url?.trim() ?? ""
      const count = b.model_count ?? 0
      if (!slug || skip.has(slug)) return false
      if (!/^https?:\/\//i.test(website)) return false
      if (!isOfficialCatalogWebsite(website)) return false
      if (count > maxModels) return false
      return true
    })
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      website_url: b.website_url!.trim(),
      model_count: b.model_count ?? 0,
      location_label: b.location_label,
    }))
    .sort((a, b) => a.model_count - b.model_count || a.slug.localeCompare(b.slug))
    .slice(0, limit)

  console.log(
    JSON.stringify(
      {
        maxModels,
        limit,
        skippedSlugCount: skip.size,
        candidateCount: candidates.length,
        next: candidates[0] ?? null,
        candidates,
      },
      null,
      2,
    ),
  )
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
