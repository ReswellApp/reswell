import type { SupabaseClient } from "@supabase/supabase-js"
import { pickCatalogBrandForNavPick } from "@/lib/brands/pick-catalog-brand-for-nav"
import { searchBrandIdsFromElasticsearch } from "@/lib/elasticsearch/brands-index"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { slugify } from "@/lib/slugify"

/** `public.brands` row shape for the `/sell` brand typeahead (nav-style dropdown). */
export type BrandCatalogSuggestRow = {
  id: string
  name: string
  slug: string
  short_description: string | null
  logo_url: string | null
  location_label: string | null
  lead_shaper_name: string | null
}

export type BrandCatalogSuggestResponse = {
  rows: BrandCatalogSuggestRow[]
  meta: { backend: "elasticsearch" | "supabase" }
}

export type DirectoryBrandMini = {
  id: string
  name: string
  slug: string
  logo_url: string | null
}

const MAX_BRAND_CATALOG_SUGGEST = 20

const BRAND_CATALOG_SELECT =
  "id, name, slug, short_description, logo_url, location_label, lead_shaper_name" as const

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Search the official brand directory (not listing-derived brand text).
 * When Elasticsearch is configured and the brands index is populated, results are ranked in ES
 * and hydrated from `public.brands`; otherwise uses Supabase `ilike`.
 */
export async function searchBrandsCatalogSuggestWithClient(
  supabase: SupabaseClient,
  qRaw: string,
): Promise<BrandCatalogSuggestResponse> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (q.length < 1) {
    return { rows: [], meta: { backend: "supabase" } }
  }

  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchBrandIdsFromElasticsearch(q, MAX_BRAND_CATALOG_SUGGEST)
      if (ids.length > 0) {
        const { data, error } = await supabase.from("brands").select(BRAND_CATALOG_SELECT).in("id", ids)

        if (!error && data?.length) {
          const byId = new Map(data.map((row) => [row.id, row as BrandCatalogSuggestRow]))
          const rows = ids
            .map((id) => byId.get(id))
            .filter((row): row is BrandCatalogSuggestRow => row != null)
          if (rows.length > 0) {
            return { rows, meta: { backend: "elasticsearch" } }
          }
        }
      }
    } catch (err) {
      console.error("[searchBrandsCatalogSuggest] Elasticsearch error, falling back to Supabase:", err)
    }
  }

  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`

  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_CATALOG_SELECT)
    .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(MAX_BRAND_CATALOG_SUGGEST)

  if (error || !data) {
    if (error && process.env.NODE_ENV === "development") {
      console.error("[searchBrandsCatalogSuggest]", error)
    }
    return { rows: [], meta: { backend: "supabase" } }
  }

  return { rows: data as BrandCatalogSuggestRow[], meta: { backend: "supabase" } }
}

/**
 * Map a free-text label (e.g. header nav chip or `/search?q=`) to a directory brand row.
 * Same resolution rules as the brand profile path helper: suggest pipeline + slug/name fallbacks.
 */
export async function resolveDirectoryBrandRowFromLabel(
  supabase: SupabaseClient,
  rawLabel: string,
): Promise<DirectoryBrandMini | null> {
  const name = (rawLabel || "").trim()
  if (!name) return null

  const { rows } = await searchBrandsCatalogSuggestWithClient(supabase, name)
  const fromSuggest = pickCatalogBrandForNavPick(
    rows.map((r) => ({ name: r.name, slug: r.slug })),
    name,
  )
  if (fromSuggest) {
    const full = rows.find((r) => r.slug === fromSuggest.slug)
    if (full) {
      return {
        id: full.id,
        name: full.name,
        slug: full.slug,
        logo_url: full.logo_url ?? null,
      }
    }
  }

  const hint = slugify(name).toLowerCase()
  if (hint.length > 0) {
    const { data: exactRow } = await supabase
      .from("brands")
      .select("id,name,slug,logo_url")
      .eq("slug", hint)
      .maybeSingle()
    if (exactRow?.id && exactRow.slug) {
      return {
        id: exactRow.id,
        name: exactRow.name,
        slug: exactRow.slug,
        logo_url: (exactRow as { logo_url?: string | null }).logo_url ?? null,
      }
    }

    const { data: prefixRows, error: prefixErr } = await supabase
      .from("brands")
      .select("id,name,slug,logo_url")
      .like("slug", `${hint}-%`)
      .order("slug", { ascending: true })
      .limit(1)
    if (!prefixErr && prefixRows?.[0]?.id && prefixRows[0].slug) {
      const r = prefixRows[0] as { id: string; name: string; slug: string; logo_url?: string | null }
      return { id: r.id, name: r.name, slug: r.slug, logo_url: r.logo_url ?? null }
    }
  }

  const safe = escapeIlikeToken(name)
  const pattern = `"%${safe}%"`
  const { data: nameRows, error: nameErr } = await supabase
    .from("brands")
    .select("id,name,slug,logo_url")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(24)

  if (!nameErr && nameRows?.length) {
    const picked = pickCatalogBrandForNavPick(nameRows, name)
    if (picked) {
      const full = nameRows.find((r) => r.slug === picked.slug) as
        | { id: string; name: string; slug: string; logo_url?: string | null }
        | undefined
      if (full?.id && full.slug) {
        return { id: full.id, name: full.name, slug: full.slug, logo_url: full.logo_url ?? null }
      }
    }
  }

  return null
}

/** Map listing-derived brand strings to directory logos for marketplace search strips (max ~16 rows). */
export async function hydrateListingBrandLabelsForMarketplaceSuggest(
  supabase: SupabaseClient,
  listingLabels: string[],
): Promise<
  Array<{ listingLabel: string; slug: string | null; logo_url: string | null }>
> {
  if (listingLabels.length === 0) return []

  const hydrated = await Promise.all(
    listingLabels.map(async (listingLabel) => {
      const row = await resolveDirectoryBrandRowFromLabel(supabase, listingLabel)
      return {
        listingLabel,
        slug: row?.slug ?? null,
        logo_url: row?.logo_url ?? null,
      }
    }),
  )

  return hydrated
}
