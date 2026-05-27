import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { listActiveListingsForBrand } from "@/lib/db/brand-listings"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchListingIdsFromElasticsearch } from "@/lib/elasticsearch/listings-index"
import {
  hydrateListingBrandLabelsForMarketplaceSuggest,
  resolveInferredBrandForMarketplaceSuggest,
  searchBrandsCatalogSuggestWithClient,
  type BrandCatalogSuggestRow,
} from "@/lib/services/brandDirectorySearch"
import {
  listingTitleThumbnailSrc,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import type {
  SearchSuggestBrandChip,
  SearchSuggestMeta,
  SearchSuggestResult,
  SuggestListing,
} from "@/lib/types/marketplace-search-suggest"

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
  const thumbSrc = listingTitleThumbnailSrc(imgs)
  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    title: (row.title as string) ?? "",
    price: typeof row.price === "number" ? row.price : parseFloat(String(row.price)) || 0,
    section: row.section as string,
    imageUrl: thumbSrc || null,
    brand: (row.brand as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
  }
}

function recentListingToSuggestListing(row: RecentListing): SuggestListing {
  const thumbSrc = listingTitleThumbnailSrc(row.listing_images)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price: row.price,
    section: row.section,
    imageUrl: thumbSrc || null,
    brand: null,
    city: row.city ?? null,
    state: row.state ?? null,
    condition: row.condition ?? null,
  }
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

export function normalizeMarketplaceSearchSuggestSection(section: string): "new" | "surfboards" {
  return section === "new" ? "new" : "surfboards"
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
  const sections =
    normalizeMarketplaceSearchSuggestSection(section) === "new" ? ["new"] : ["surfboards"]

  const catalogBrands = await searchBrandsCatalogSuggestWithClient(supabase, q)
  const inferredBrand = await resolveInferredBrandForMarketplaceSuggest(
    supabase,
    q,
    catalogBrands.rows,
  )
  const pickedCatalogSlug =
    inferredBrand?.slug ??
    catalogBrands.rows.find((r) => r.name.toLowerCase().includes(q.toLowerCase()))?.slug ??
    null

  const textOr = `title.ilike.${pattern},description.ilike.${pattern},brand.ilike.${pattern}`

  const [listingsRes, titlesRes, categoriesRes, brandsRes] = await Promise.all([
    supabase
      .from("listings")
      .select(
        `
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
      `,
      )
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
      const ids = await searchListingIdsFromElasticsearch(q, MAX_LISTINGS, { sections })
      if (ids.length > 0) {
        const { data: esRows } = await supabase
          .from("listings")
          .select(
            `
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
          `,
          )
          .in("id", ids)
          .eq("status", "active")
          .eq("hidden_from_site", false)

        if (esRows?.length) {
          const byId = new Map(
            (esRows as Record<string, unknown>[]).map((row) => [row.id as string, row]),
          )
          const ordered = ids
            .map((id) => byId.get(id))
            .filter((row): row is Record<string, unknown> => row != null)
            .map((row) => rowToSuggestListing(row))
          if (ordered.length > 0) {
            listings = ordered
            listingsBackend = "elasticsearch"
          }
        }
      }
    } catch (err) {
      console.error("[searchSuggest] Elasticsearch listing suggestions failed, using Supabase:", err)
    }
  }

  if (inferredBrand) {
    const brandListings = await listActiveListingsForBrand(supabase, inferredBrand, {
      limit: MAX_LISTINGS,
      sections,
    })
    if (brandListings.length > 0) {
      listings = brandListings.map(recentListingToSuggestListing)
      listingsBackend = "supabase"
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
