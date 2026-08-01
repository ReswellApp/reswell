import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { listActiveListingsForBrand } from "@/lib/db/brand-listings"
import {
  searchBrandModelsForBrandId,
  searchBrandModelsWithBrandsForSuggest,
} from "@/lib/db/brand-models"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchListingIdsFromElasticsearch } from "@/lib/elasticsearch/listings-index"
import {
  marketplaceSearchSuggestSections,
  navSearchSuggestSectionKey,
  type NavSearchSuggestSectionKey,
} from "@/lib/header-nav-marketplace-search"
import {
  hydrateListingBrandLabelsForMarketplaceSuggest,
  resolveInferredBrandForMarketplaceSuggest,
  searchBrandsCatalogSuggestWithClient,
  type BrandCatalogSuggestRow,
  type DirectoryBrandMini,
} from "@/lib/services/brandDirectorySearch"
import {
  listingTitleThumbnailCandidates,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import type {
  SearchSuggestBrandChip,
  SearchSuggestMeta,
  SearchSuggestResult,
  SuggestListing,
} from "@/lib/types/marketplace-search-suggest"
import { parseMarketplaceQuery } from "@/lib/services/marketplaceQueryParse"
import {
  isBrandOnlyMarketplaceSuggestQuery,
  residualMarketplaceQueryAfterBrand,
} from "@/lib/utils/marketplace-brand-query"

const MAX_TITLES = 20
const MAX_CATEGORIES = 12
const MAX_BRANDS = 16
const MAX_LISTINGS = 12
const TITLE_SUGGEST_FETCH = 80

const SUGGEST_LISTING_IMAGES_SELECT = "listing_images (url, thumbnail_url, is_primary)"

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function dedupeListingBrandInputsForSuggest(
  rows: { brand: string | null; brand_id: string | null }[],
  maxBrands: number,
): Array<{ listingLabel: string; brandId: string | null }> {
  const map = new Map<string, { listingLabel: string; brandId: string | null }>()
  for (const row of rows) {
    const listingLabel = row.brand?.trim()
    if (!listingLabel) continue
    const key = listingLabel.toLowerCase()
    const brandId =
      typeof row.brand_id === "string" && row.brand_id.length > 0 ? row.brand_id : null
    const existing = map.get(key)
    if (!existing) {
      if (map.size >= maxBrands) continue
      map.set(key, { listingLabel, brandId })
    } else if (!existing.brandId && brandId) {
      existing.brandId = brandId
    }
  }
  return [...map.values()]
}

function rowToSuggestListing(row: Record<string, unknown>): SuggestListing {
  const imgs = (row.listing_images as ListingImageForCard[] | null) ?? []
  const imageUrlCandidates = listingTitleThumbnailCandidates(imgs)
  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    title: (row.title as string) ?? "",
    price: typeof row.price === "number" ? row.price : parseFloat(String(row.price)) || 0,
    section: row.section as string,
    imageUrl: imageUrlCandidates[0] ?? null,
    imageUrlCandidates,
    brand: (row.brand as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
  }
}

function recentListingToSuggestListing(row: RecentListing): SuggestListing {
  const imageUrlCandidates = listingTitleThumbnailCandidates(row.listing_images)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price: row.price,
    section: row.section,
    imageUrl: imageUrlCandidates[0] ?? null,
    imageUrlCandidates,
    brand: null,
    city: row.city ?? null,
    state: row.state ?? null,
    condition: row.condition ?? null,
  }
}

const SUGGEST_LISTING_ROW_SELECT = `
  id,
  slug,
  title,
  price,
  section,
  city,
  state,
  brand,
  condition,
  ${SUGGEST_LISTING_IMAGES_SELECT}
`

async function listSuggestListingsByBrandModelIds(
  supabase: SupabaseClient,
  modelIds: string[],
  sections: string[],
  limit: number,
): Promise<SuggestListing[]> {
  if (modelIds.length === 0) return []
  const { data, error } = await supabase
    .from("listings")
    .select(SUGGEST_LISTING_ROW_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("section", sections)
    .in("brand_model_id", modelIds)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[searchSuggest] brand_model_id listing lookup failed:", error.message)
    return []
  }
  return ((data || []) as Record<string, unknown>[]).map((row) => rowToSuggestListing(row))
}

/** Match catalog model / listing model text within an inferred brand. */
async function listSuggestListingsForBrandResidualQuery(
  supabase: SupabaseClient,
  brand: DirectoryBrandMini,
  residualQuery: string,
  sections: string[],
  limit: number,
): Promise<SuggestListing[]> {
  const safe = escapeIlikeToken(residualQuery)
  const pattern = `"%${safe}%"`
  const namePattern = `"%${escapeIlikeToken(brand.name)}%"`

  const catalogModels = await searchBrandModelsForBrandId(supabase, brand.id, residualQuery, 8)
  const modelIds = catalogModels.map((m) => m.id)

  let query = supabase
    .from("listings")
    .select(SUGGEST_LISTING_ROW_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("section", sections)
    .or(`brand_id.eq.${brand.id},brand.ilike.${namePattern}`)

  if (modelIds.length > 0) {
    const idList = modelIds.join(",")
    query = query.or(
      `brand_model_id.in.(${idList}),model.ilike.${pattern},title.ilike.${pattern}`,
    )
  } else {
    query = query.or(`model.ilike.${pattern},title.ilike.${pattern},description.ilike.${pattern}`)
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit)
  if (error) {
    console.error("[searchSuggest] brand residual listing lookup failed:", error.message)
    return []
  }
  return ((data || []) as Record<string, unknown>[]).map((row) => rowToSuggestListing(row))
}

function pinSuggestListingsFront(
  pinned: SuggestListing[],
  rest: SuggestListing[],
  limit: number,
): SuggestListing[] {
  if (pinned.length === 0) return rest.slice(0, limit)
  const seen = new Set(pinned.map((l) => l.id))
  return [...pinned, ...rest.filter((l) => !seen.has(l.id))].slice(0, limit)
}

function catalogRowsToSuggestBrandChips(
  rows: BrandCatalogSuggestRow[],
  pickedSlug: string | null,
  max: number,
): SearchSuggestBrandChip[] {
  const ordered =
    pickedSlug && rows.some((r) => r.slug === pickedSlug)
      ? [
          rows.find((r) => r.slug === pickedSlug)!,
          ...rows.filter((r) => r.slug !== pickedSlug),
        ]
      : rows
  const seen = new Set<string>()
  const chips: SearchSuggestBrandChip[] = []
  for (const row of ordered) {
    const key = row.slug.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    chips.push({
      listingLabel: row.name,
      slug: row.slug,
      logo_url: row.logo_url ?? null,
    })
    if (chips.length >= max) break
  }
  return chips
}

export function normalizeMarketplaceSearchSuggestSection(
  section: string,
): NavSearchSuggestSectionKey {
  return navSearchSuggestSectionKey(section)
}

export function normalizeMarketplaceSearchSuggestQuery(qRaw: string): string {
  return (qRaw || "").trim().replace(/%/g, "")
}

export async function runMarketplaceSearchSuggest(
  supabase: SupabaseClient,
  qRaw: string,
  section: string,
): Promise<SearchSuggestResult> {
  const q = normalizeMarketplaceSearchSuggestQuery(qRaw)
  if (!q || q.length < 2) {
    return {
      titles: [],
      categories: [],
      brands: [],
      listings: [],
      meta: { listingsBackend: "supabase" },
    }
  }

  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`

  const catalogBrands = await searchBrandsCatalogSuggestWithClient(supabase, q)
  const inferredBrand = await resolveInferredBrandForMarketplaceSuggest(
    supabase,
    q,
    catalogBrands.rows,
  )
  const parsed = await parseMarketplaceQuery(supabase, q, {
    brandHint: inferredBrand,
  })
  // Query tokens like "fins" scope suggest to that section; nav `section` param is the fallback.
  const sections = parsed.sectionIntent
    ? [parsed.sectionIntent]
    : marketplaceSearchSuggestSections(section)
  const pickedCatalogSlug =
    parsed.brand?.slug ??
    inferredBrand?.slug ??
    catalogBrands.rows.find((r) => r.name.toLowerCase().includes(q.toLowerCase()))?.slug ??
    null

  const ilikeQuery = parsed.textQuery || q
  const ilikeSafe = escapeIlikeToken(ilikeQuery)
  const ilikePattern = `"%${ilikeSafe}%"`
  const textOr = `title.ilike.${ilikePattern},description.ilike.${ilikePattern},brand.ilike.${ilikePattern},model.ilike.${ilikePattern}`

  const hydrateSuggestListingsFromIds = async (ids: string[]): Promise<SuggestListing[]> => {
    if (ids.length === 0) return []
    const { data: esRows } = await supabase
      .from("listings")
      .select(SUGGEST_LISTING_ROW_SELECT)
      .in("id", ids)
      .eq("status", "active")
      .eq("hidden_from_site", false)
    if (!esRows?.length) return []
    const byId = new Map(
      (esRows as Record<string, unknown>[]).map((row) => [row.id as string, row]),
    )
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is Record<string, unknown> => row != null)
      .map((row) => rowToSuggestListing(row))
  }

  const [listingsRes, titlesRes, categoriesRes, brandsRes] = await Promise.all([
    supabase
      .from("listings")
      .select(SUGGEST_LISTING_ROW_SELECT)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .in("section", sections)
      .or(textOr)
      .order("created_at", { ascending: false })
      .limit(MAX_LISTINGS),
    supabase
      .from("listings")
      .select("title")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .in("section", sections)
      .or(textOr)
      .order("created_at", { ascending: false })
      .limit(TITLE_SUGGEST_FETCH),
    supabase
      .from("categories")
      .select("name, slug")
      .eq("board", true)
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(MAX_CATEGORIES * 3),
    supabase
      .from("listings")
      .select("brand, brand_id")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .in("section", sections)
      .not("brand", "is", null)
      .ilike("brand", `%${safe}%`)
      .order("created_at", { ascending: false })
      .limit(MAX_BRANDS * 4),
  ])

  let listings: SuggestListing[] = (listingsRes.data || []).map((row: Record<string, unknown>) =>
    rowToSuggestListing(row),
  )
  let listingsBackend: SearchSuggestMeta["listingsBackend"] = "supabase"

  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchListingIdsFromElasticsearch(parsed.textQuery || q, MAX_LISTINGS, {
        sections,
        expansions: parsed.expansions,
        brandId: parsed.modelIds.length > 0 ? null : parsed.brand?.id ?? null,
        brandModelIds: parsed.modelIds.length > 0 ? parsed.modelIds : null,
        lengthInches: parsed.lengthInches,
      })
      const ordered = await hydrateSuggestListingsFromIds(ids)
      if (ordered.length > 0) {
        listings = ordered
        listingsBackend = "elasticsearch"
      }
    } catch (err) {
      console.error("[searchSuggest] Elasticsearch listing suggestions failed, using Supabase:", err)
    }
  }

  const effectiveBrand = parsed.brand
    ? {
        id: parsed.brand.id,
        name: parsed.brand.name,
        slug: parsed.brand.slug,
        logo_url: inferredBrand?.logo_url ?? null,
      }
    : inferredBrand

  // Brand inventory fill only for brand-only queries (e.g. "channel islands").
  // Brand + model keeps relevance results, with catalog/model matches pinned front.
  if (effectiveBrand && parsed.isBrandOnly) {
    const brandListings = await listActiveListingsForBrand(supabase, effectiveBrand, {
      limit: MAX_LISTINGS,
      sections,
    })
    if (brandListings.length > 0) {
      listings = brandListings.map(recentListingToSuggestListing)
      listingsBackend = "supabase"
    } else if (parsed.sectionIntent && isElasticsearchConfigured()) {
      // Co-brand / collaborator: manufacturer brand_id may differ (Futures AM2 × CI).
      // Section-scoped text search without brand_id hard filter.
      try {
        const ids = await searchListingIdsFromElasticsearch(
          parsed.textQuery || effectiveBrand.name || q,
          MAX_LISTINGS,
          {
            sections,
            expansions: parsed.expansions,
            brandId: null,
          },
        )
        const ordered = await hydrateSuggestListingsFromIds(ids)
        if (ordered.length > 0) {
          listings = ordered
          listingsBackend = "elasticsearch"
        }
      } catch (err) {
        console.error(
          "[searchSuggest] section-scoped brand text fallback failed, keeping prior listings:",
          err,
        )
      }
    }
  } else if (parsed.modelIds.length > 0) {
    const modelListings = await listSuggestListingsByBrandModelIds(
      supabase,
      parsed.modelIds,
      sections,
      MAX_LISTINGS,
    )
    if (modelListings.length > 0) {
      listings = pinSuggestListingsFront(modelListings, listings, MAX_LISTINGS)
    }
  } else if (effectiveBrand) {
    const residual =
      parsed.residualText || residualMarketplaceQueryAfterBrand(q, effectiveBrand.name)
    if (residual && !isBrandOnlyMarketplaceSuggestQuery(q, effectiveBrand.name)) {
      const residualListings = await listSuggestListingsForBrandResidualQuery(
        supabase,
        effectiveBrand,
        residual,
        sections,
        MAX_LISTINGS,
      )
      if (residualListings.length > 0) {
        listings = pinSuggestListingsFront(residualListings, listings, MAX_LISTINGS)
      }
    }
  } else {
    const catalogModels = await searchBrandModelsWithBrandsForSuggest(supabase, q, 8)
    if (catalogModels.length > 0) {
      const modelListings = await listSuggestListingsByBrandModelIds(
        supabase,
        catalogModels.map((m) => m.id),
        sections,
        MAX_LISTINGS,
      )
      if (modelListings.length > 0) {
        listings = pinSuggestListingsFront(modelListings, listings, MAX_LISTINGS)
      }
    }
  }

  const titleSet = new Set<string>()
  const titles = (titlesRes.data || [])
    .map((r) => r.title?.trim())
    .filter((t): t is string => !!t && t.length > 0)
    .filter((t) => {
      const k = t.toLowerCase()
      if (titleSet.has(k)) return false
      titleSet.add(k)
      return true
    })
    .slice(0, MAX_TITLES)

  const categories = (categoriesRes.data || [])
    .map((c) => c.name || c.slug)
    .filter(Boolean)
    .slice(0, MAX_CATEGORIES) as string[]

  let brands = catalogRowsToSuggestBrandChips(
    catalogBrands.rows,
    pickedCatalogSlug,
    MAX_BRANDS,
  )
  if (brands.length === 0) {
    const brandInputs = dedupeListingBrandInputsForSuggest(
      (brandsRes.data || []) as { brand: string | null; brand_id: string | null }[],
      MAX_BRANDS,
    )
    brands = await hydrateListingBrandLabelsForMarketplaceSuggest(supabase, brandInputs)
  }

  return { titles, categories, brands, listings, meta: { listingsBackend } }
}
