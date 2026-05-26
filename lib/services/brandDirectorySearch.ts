import type { SupabaseClient } from "@supabase/supabase-js"
import { pickCatalogBrandForNavPick } from "@/lib/brands/pick-catalog-brand-for-nav"
import { searchBrandIdsFromElasticsearch } from "@/lib/elasticsearch/brands-index"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { slugify } from "@/lib/slugify"
import {
  fuzzyBrandLookupTokens,
  fuzzyBrandNamePrefix,
  marketplaceBrandQueryCandidates,
  pickClosestBrandNameMatch,
} from "@/lib/utils/marketplace-brand-query"

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

/** Substring `%q%` matches inside unrelated tokens (e.g. "ch" → "Doug Schroedel"). Use prefix until 4 chars. */
const BRAND_CATALOG_SUBSTRING_MIN_LEN = 4

const BRAND_CATALOG_SELECT =
  "id, name, slug, short_description, logo_url, location_label, lead_shaper_name" as const

function escapeIlikeToken(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function brandCatalogIlikePattern(q: string): string {
  const safe = escapeIlikeToken(q)
  return q.length < BRAND_CATALOG_SUBSTRING_MIN_LEN ? `"${safe}%"` : `"%${safe}%"`
}

async function queryBrandsCatalogByIlike(
  supabase: SupabaseClient,
  q: string,
): Promise<BrandCatalogSuggestRow[]> {
  const pattern = brandCatalogIlikePattern(q)
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
    return []
  }

  return data as BrandCatalogSuggestRow[]
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
      const candidateQueries = [
        q,
        ...marketplaceBrandQueryCandidates(q).filter(
          (c) => c.toLowerCase() !== q.toLowerCase(),
        ),
      ]
      for (const candidate of candidateQueries) {
        const ids = await searchBrandIdsFromElasticsearch(candidate, MAX_BRAND_CATALOG_SUGGEST)
        if (ids.length === 0) continue
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

  let rows = await queryBrandsCatalogByIlike(supabase, q)
  if (rows.length === 0) {
    for (const candidate of marketplaceBrandQueryCandidates(q)) {
      if (candidate.toLowerCase() === q.toLowerCase()) continue
      const retryRows = await queryBrandsCatalogByIlike(supabase, candidate)
      if (retryRows.length > 0) {
        rows = retryRows
        break
      }
    }
  }

  return { rows, meta: { backend: "supabase" } }
}

function directoryBrandMiniFromRow(row: {
  id: string
  name: string
  slug: string
  logo_url?: string | null
}): DirectoryBrandMini {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo_url: row.logo_url ?? null,
  }
}

async function resolveDirectoryBrandBySlugHint(
  supabase: SupabaseClient,
  label: string,
): Promise<DirectoryBrandMini | null> {
  const hint = slugify(label).toLowerCase()
  if (hint.length === 0) return null

  const { data: exactRow } = await supabase
    .from("brands")
    .select("id,name,slug,logo_url")
    .eq("slug", hint)
    .maybeSingle()
  if (exactRow?.id && exactRow.slug) {
    return directoryBrandMiniFromRow(exactRow)
  }

  const { data: prefixRows, error: prefixErr } = await supabase
    .from("brands")
    .select("id,name,slug,logo_url")
    .like("slug", `${hint}-%`)
    .order("slug", { ascending: true })
    .limit(1)
  if (!prefixErr && prefixRows?.[0]?.id && prefixRows[0].slug) {
    return directoryBrandMiniFromRow(prefixRows[0])
  }

  return null
}

async function resolveDirectoryBrandFromNameIlike(
  supabase: SupabaseClient,
  label: string,
  originalLabel: string,
): Promise<DirectoryBrandMini | null> {
  const safe = escapeIlikeToken(label)
  const pattern = `"%${safe}%"`
  const { data: nameRows, error: nameErr } = await supabase
    .from("brands")
    .select("id,name,slug,logo_url")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(40)

  if (nameErr || !nameRows?.length) return null

  const picked =
    pickCatalogBrandForNavPick(nameRows, originalLabel) ??
    pickCatalogBrandForNavPick(nameRows, label) ??
    pickClosestBrandNameMatch(nameRows, label)

  if (!picked?.slug) return null
  const full = nameRows.find((r) => r.slug === picked.slug)
  if (!full?.id || !full.slug) return null
  return directoryBrandMiniFromRow(full)
}

/**
 * Typo-tolerant brand match when substring/suggest miss (e.g. "andreni" → Andreini).
 * Uses Elasticsearch suggest when available, then a short prefix scan + edit distance.
 */
async function resolveDirectoryBrandByFuzzyCatalogMatch(
  supabase: SupabaseClient,
  rawLabel: string,
): Promise<DirectoryBrandMini | null> {
  const tokens = fuzzyBrandLookupTokens(rawLabel)
  if (tokens.length === 0) return null

  for (const token of tokens) {
    const { rows: suggestRows } = await searchBrandsCatalogSuggestWithClient(supabase, token)
    if (suggestRows.length > 0) {
      const closestSuggest = pickClosestBrandNameMatch(suggestRows, token)
      if (closestSuggest?.id && closestSuggest.slug) {
        return directoryBrandMiniFromRow(closestSuggest)
      }
    }

    const prefix = fuzzyBrandNamePrefix(token)
    if (prefix.length < 3) continue

    const safe = escapeIlikeToken(prefix)
    const pattern = `"%${safe}%"`
    const { data: prefixRows, error } = await supabase
      .from("brands")
      .select("id,name,slug,logo_url")
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(100)

    if (error || !prefixRows?.length) continue

    const closest = pickClosestBrandNameMatch(prefixRows, token)
    if (closest?.id && closest.slug) {
      return directoryBrandMiniFromRow(closest)
    }
  }

  return null
}

/**
 * Map a free-text label (e.g. header nav chip or `/search?q=`) to a directory brand row.
 * Same resolution rules as the brand profile path helper: suggest pipeline + slug/name fallbacks.
 * Strips generic words ("surfboards") and tolerates typos via closest name match.
 */
export async function resolveDirectoryBrandRowFromLabel(
  supabase: SupabaseClient,
  rawLabel: string,
): Promise<DirectoryBrandMini | null> {
  const name = (rawLabel || "").trim()
  if (!name) return null

  const candidates = marketplaceBrandQueryCandidates(name)

  for (const candidate of candidates) {
    const { rows } = await searchBrandsCatalogSuggestWithClient(supabase, candidate)
    const fromSuggest = pickCatalogBrandForNavPick(
      rows.map((r) => ({ name: r.name, slug: r.slug })),
      name,
    )
    if (fromSuggest) {
      const full = rows.find((r) => r.slug === fromSuggest.slug)
      if (full) {
        return directoryBrandMiniFromRow(full)
      }
    }

    const bySlug = await resolveDirectoryBrandBySlugHint(supabase, candidate)
    if (bySlug) return bySlug

    const byName = await resolveDirectoryBrandFromNameIlike(supabase, candidate, name)
    if (byName) return byName
  }

  return resolveDirectoryBrandByFuzzyCatalogMatch(supabase, name)
}

/**
 * Infer the directory brand a user is typing toward (nav/search suggest).
 * Uses catalog suggest rows first, then full label resolution.
 */
export async function resolveInferredBrandForMarketplaceSuggest(
  supabase: SupabaseClient,
  q: string,
  catalogRows: BrandCatalogSuggestRow[],
): Promise<DirectoryBrandMini | null> {
  const picked = pickCatalogBrandForNavPick(
    catalogRows.map((r) => ({ name: r.name, slug: r.slug })),
    q,
  )
  if (picked) {
    const full = catalogRows.find((r) => r.slug === picked.slug)
    if (full?.id && full.slug) {
      return directoryBrandMiniFromRow(full)
    }
  }
  return resolveDirectoryBrandRowFromLabel(supabase, q)
}

/** Map listing-derived brands to directory slug + logo for marketplace search strips (max ~16 rows). */
export async function hydrateListingBrandLabelsForMarketplaceSuggest(
  supabase: SupabaseClient,
  inputs: Array<{ listingLabel: string; brandId: string | null }>,
): Promise<
  Array<{ listingLabel: string; slug: string | null; logo_url: string | null }>
> {
  if (inputs.length === 0) return []

  const ids = [...new Set(inputs.map((i) => i.brandId).filter((id): id is string => !!id))]
  let idToRow = new Map<string, DirectoryBrandMini>()
  if (ids.length > 0) {
    const { data, error } = await supabase.from("brands").select("id,name,slug,logo_url").in("id", ids)
    if (!error && data?.length) {
      idToRow = new Map(
        data.map((row) => [
          row.id,
          {
            id: row.id,
            name: row.name,
            slug: row.slug,
            logo_url: row.logo_url ?? null,
          },
        ]),
      )
    }
  }

  return Promise.all(
    inputs.map(async (input) => {
      const linked = input.brandId ? idToRow.get(input.brandId) : undefined
      if (linked?.slug) {
        return {
          listingLabel: input.listingLabel,
          slug: linked.slug,
          logo_url: linked.logo_url ?? null,
        }
      }
      const row = await resolveDirectoryBrandRowFromLabel(supabase, input.listingLabel)
      return {
        listingLabel: input.listingLabel,
        slug: row?.slug ?? null,
        logo_url: row?.logo_url ?? null,
      }
    }),
  )
}
