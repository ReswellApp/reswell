import { createAnonSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server"
import { searchBrandModelsWithBrandsForSuggest } from "@/lib/db/brand-models"
import {
  PUBLIC_RESEARCH_LISTING_SELECT,
  searchPublicResearchListingsIlike,
  selectActiveSurfboardAskingForPricing,
  selectBrandModelByBrandAndName,
  selectPublicResearchListingsByIds,
  selectSnapshotListingIdsForCatalog,
  selectSoldSurfboardOrdersForPricing,
  selectSurfboardListingIdsForBrand,
  selectSurfboardListingIdsForBrandModelText,
  type PublicResearchListingRow,
  type PublicResearchSellerRow,
  type PublicResearchSoldOrderRow,
} from "@/lib/db/public-research-api"
import { marketplaceSearchSuggestSections } from "@/lib/header-nav-marketplace-search"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchListingIdsFromElasticsearch } from "@/lib/elasticsearch/listings-index"
import { listingDetailHref } from "@/lib/listing-href"
import {
  listingTitleThumbnailCandidates,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import {
  formatCondition,
  getPublicSellerDisplayName,
} from "@/lib/listing-labels"
import { findListingByParam } from "@/lib/listing-query"
import {
  isListingPubliclyVisible,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { resolveDirectoryBrandRowFromLabel } from "@/lib/services/brandDirectorySearch"
import { parseMarketplaceQuery } from "@/lib/services/marketplaceQueryParse"
import { sellerProfileHref } from "@/lib/seller-slug"
import { absoluteUrl } from "@/lib/site-metadata"
import { slugify } from "@/lib/slugify"
import type {
  PublicApiCatalog,
  PublicApiListingCard,
  PublicApiListingDetail,
  PublicApiMarketStats,
  PublicApiModelCard,
  PublicApiPricingResult,
  PublicApiSoldComp,
} from "@/lib/types/public-research-api"
import type { PublicApiPricingQuery, PublicApiSearchQuery } from "@/lib/validations/public-api"

const PRICING_ROW_CAP = 400
const RECENT_SOLD_LIMIT = 10
const NO_MATCH_LISTING_ID = "00000000-0000-0000-0000-000000000000"

export type PublicResearchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

function moneyUsd(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function moneyRequired(value: number | string | null | undefined): number {
  return moneyUsd(value) ?? 0
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const raw =
    sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
  return Math.round(raw * 100) / 100
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, n) => sum + n, 0) / values.length) * 100) / 100
}

function statsFromValues(values: number[]): PublicApiMarketStats {
  if (values.length === 0) {
    return { min_usd: null, max_usd: null, avg_usd: null, median_usd: null, count: 0 }
  }
  return {
    min_usd: Math.min(...values),
    max_usd: Math.max(...values),
    avg_usd: avg(values),
    median_usd: median(values),
    count: values.length,
  }
}

function pickSeller(
  profiles: PublicResearchSellerRow | PublicResearchSellerRow[] | null,
): PublicResearchSellerRow | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

function absoluteMediaUrl(path: string | null | undefined): string | null {
  if (!path?.trim()) return null
  const raw = path.trim()
  if (/^https?:\/\//i.test(raw)) return raw
  return absoluteUrl(raw)
}

function listingImageUrl(images: ListingImageForCard[] | null | undefined): string | null {
  return absoluteMediaUrl(listingTitleThumbnailCandidates(images)[0] ?? null)
}

function listingGalleryUrls(
  images: Array<ListingImageForCard & { sort_order?: number | null }> | null | undefined,
): string[] {
  const list = [...(images ?? [])].sort((a, b) => {
    const aPrimary = a.is_primary ? 0 : 1
    const bPrimary = b.is_primary ? 0 : 1
    if (aPrimary !== bPrimary) return aPrimary - bPrimary
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const urls: string[] = []
  const seen = new Set<string>()
  for (const img of list) {
    const src = listingImageUrl([img])
    if (!src || seen.has(src)) continue
    seen.add(src)
    urls.push(src)
    if (urls.length >= 8) break
  }
  return urls
}

function toListingCard(row: PublicResearchListingRow): PublicApiListingCard {
  const priceUsd = moneyRequired(row.price)
  const href = listingDetailHref({ id: row.id, slug: row.slug, section: row.section })
  return {
    id: row.id,
    slug: row.slug,
    title: row.title?.trim() || "Untitled listing",
    brand: row.brand?.trim() || null,
    model: row.model?.trim() || null,
    condition: row.condition,
    condition_label: row.condition ? formatCondition(row.condition) : null,
    section: row.section,
    board_type: row.board_type,
    dimensions: row.dimensions?.trim() || null,
    price_usd: priceUsd,
    price_cents: Math.round(priceUsd * 100),
    city: row.city?.trim() || null,
    state: row.state?.trim() || null,
    shipping_available: Boolean(row.shipping_available),
    local_pickup: Boolean(row.local_pickup),
    image_url: listingImageUrl(row.listing_images),
    urls: {
      html: absoluteUrl(href),
      api: absoluteUrl(`/api/public/listings/${row.slug?.trim() || row.id}`),
    },
  }
}

function researchDb() {
  try {
    return createServiceRoleClient()
  } catch {
    return createAnonSupabaseClient()
  }
}

export function getPublicApiCatalog(): PublicApiCatalog {
  const origin = publicSiteOrigin()
  return {
    name: "Reswell public research API",
    docs: `${origin}/public-api`,
    llms_txt: `${origin}/llms.txt`,
    openapi_json: `${origin}/openapi.json`,
    endpoints: [
      {
        method: "GET",
        path: "/api/public/search?q={query}&type=models&limit=5",
        summary: "Find a catalog model or a specific listing",
      },
      {
        method: "GET",
        path: "/api/public/pricing?brand={brand}&model={model}",
        summary: "Used-board asking and sold comps for a brand / model",
      },
      {
        method: "GET",
        path: "/api/public/listings/{id}",
        summary: "Listing detail for a specific copy (id or slug)",
      },
    ],
  }
}

export async function searchPublicResearchService(
  input: PublicApiSearchQuery,
): Promise<PublicResearchResult<{ type: PublicApiSearchQuery["type"]; results: unknown[] }>> {
  const supabase = createAnonSupabaseClient()

  if (input.type === "models") {
    const models = await searchBrandModelsWithBrandsForSuggest(researchDb(), input.q, input.limit)
    const results: PublicApiModelCard[] = models.map((model) => {
      const q = `${model.brandName} ${model.name}`
      return {
        id: model.id,
        name: model.name,
        brand: model.brandName,
        brand_slug: model.brandSlug,
        urls: {
          brand_html: absoluteUrl(`/brands/${model.brandSlug}`),
          search_html: absoluteUrl(`/search?q=${encodeURIComponent(q)}`),
          pricing_api: absoluteUrl(
            `/api/public/pricing?brand=${encodeURIComponent(model.brandSlug)}&model=${encodeURIComponent(slugify(model.name))}`,
          ),
        },
      }
    })
    return { ok: true, data: { type: "models", results } }
  }

  const parsed = await parseMarketplaceQuery(supabase, input.q)
  const sections = parsed.sectionIntent
    ? [parsed.sectionIntent]
    : marketplaceSearchSuggestSections("marketplace")
  const textQuery = parsed.textQuery || input.q

  let rows: PublicResearchListingRow[] = []
  if (isElasticsearchConfigured()) {
    try {
      const ids = await searchListingIdsFromElasticsearch(textQuery, input.limit, {
        sections,
        expansions: parsed.expansions,
        brandId: parsed.modelIds.length > 0 ? null : parsed.brand?.id ?? null,
        brandModelIds: parsed.modelIds.length > 0 ? parsed.modelIds : null,
        lengthInches: parsed.lengthInches,
      })
      rows = await selectPublicResearchListingsByIds(supabase, ids)
    } catch (error) {
      console.error("[public-research-api] elasticsearch search failed", {
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (rows.length === 0) {
    rows = await searchPublicResearchListingsIlike(supabase, textQuery, sections, input.limit)
  }

  const visible = rows
    .filter((row) => isListingPubliclyVisible(row))
    .slice(0, input.limit)
    .map(toListingCard)

  return { ok: true, data: { type: "listings", results: visible } }
}

export async function getPublicListingService(
  listingParam: string,
): Promise<PublicResearchResult<PublicApiListingDetail>> {
  const supabase = createAnonSupabaseClient()
  const found = await findListingByParam(supabase, listingParam, {
    select: PUBLIC_RESEARCH_LISTING_SELECT,
  })
  const row = found.listing as PublicResearchListingRow | null
  if (!row) {
    return { ok: false, status: 404, error: "Listing not found" }
  }

  const soldVisible = isListingVisibleInPublicSoldFeed({
    ...row,
    title: row.title,
  })
  if (!isListingPubliclyVisible(row) && !soldVisible) {
    return { ok: false, status: 404, error: "Listing not found" }
  }

  const card = toListingCard(row)
  const seller = pickSeller(row.profiles)
  const sellerHref = seller ? sellerProfileHref(seller) : "/sellers"
  const sellerUrl = sellerHref === "/sellers" ? null : absoluteUrl(sellerHref)

  return {
    ok: true,
    data: {
      ...card,
      status: row.status,
      description: row.description?.trim() || null,
      image_urls: listingGalleryUrls(row.listing_images),
      seller: {
        name: getPublicSellerDisplayName(seller),
        store_url: sellerUrl,
      },
      urls: {
        ...card.urls,
        seller: sellerUrl,
      },
    },
  }
}

function modelSlugCandidates(modelRaw: string): string[] {
  const trimmed = modelRaw.trim()
  const slugged = slugify(trimmed)
  return [...new Set([trimmed.toLowerCase(), slugged].filter(Boolean))]
}

export async function getPublicPricingService(
  input: PublicApiPricingQuery,
): Promise<PublicResearchResult<PublicApiPricingResult>> {
  const supabase = researchDb()
  const brand = await resolveDirectoryBrandRowFromLabel(supabase, input.brand)
  if (!brand) {
    return { ok: false, status: 404, error: "Brand not found" }
  }

  const modelRaw = input.model?.trim() || ""
  let modelName: string | null = null
  let modelSlug: string | null = null

  if (modelRaw) {
    const catalogModel = await selectBrandModelByBrandAndName(supabase, brand.id, modelRaw)
    if (catalogModel) {
      modelName = catalogModel.name
      modelSlug = slugify(catalogModel.name)
    } else {
      const candidates = modelSlugCandidates(modelRaw)
      modelSlug = candidates[candidates.length - 1] ?? slugify(modelRaw)
      modelName = modelRaw
    }
  }

  let listingIds: string[] | null = null
  if (modelSlug) {
    const fromSnapshots = await selectSnapshotListingIdsForCatalog(
      supabase,
      brand.slug,
      modelSlug,
      PRICING_ROW_CAP,
    )
    const fromModelText =
      fromSnapshots.length > 0
        ? []
        : await selectSurfboardListingIdsForBrandModelText(
            supabase,
            brand.id,
            modelName ?? modelRaw,
            PRICING_ROW_CAP,
          )
    const combined = fromSnapshots.length > 0 ? fromSnapshots : fromModelText
    listingIds = combined.length > 0 ? combined : [NO_MATCH_LISTING_ID]
  } else {
    listingIds = await selectSurfboardListingIdsForBrand(supabase, brand.id, PRICING_ROW_CAP)
  }

  const fromIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const [askingRows, soldRows] = await Promise.all([
    selectActiveSurfboardAskingForPricing(supabase, {
      brandId: brand.id,
      listingIds: modelSlug ? listingIds : null,
      limit: PRICING_ROW_CAP,
    }),
    selectSoldSurfboardOrdersForPricing(supabase, {
      listingIds: listingIds ?? [],
      fromIso,
      limit: PRICING_ROW_CAP,
    }),
  ])

  const askingPrices = askingRows
    .map((row) => moneyUsd(row.price))
    .filter((n): n is number => n != null && n > 0)

  const soldPrices: number[] = []
  const recentSold: PublicApiSoldComp[] = []
  for (const row of soldRows) {
    const price = moneyUsd(row.amount)
    if (price == null || price <= 0) continue
    soldPrices.push(price)
    if (recentSold.length < RECENT_SOLD_LIMIT) {
      recentSold.push(toSoldComp(row, price))
    }
  }

  const searchQ = modelName ? `${brand.name} ${modelName}` : brand.name

  return {
    ok: true,
    data: {
      brand: { id: brand.id, name: brand.name, slug: brand.slug },
      model: modelName && modelSlug ? { name: modelName, slug: modelSlug } : null,
      range: "365d",
      asking: statsFromValues(askingPrices),
      sold: statsFromValues(soldPrices),
      recent_sold: recentSold,
      urls: {
        brand_html: absoluteUrl(`/brands/${brand.slug}`),
        search_html: absoluteUrl(`/search?q=${encodeURIComponent(searchQ)}`),
        sold_html: absoluteUrl("/sold"),
      },
    },
  }
}

function toSoldComp(row: PublicResearchSoldOrderRow, price: number): PublicApiSoldComp {
  const listing = row.listings
  const href =
    listing && isListingVisibleInPublicSoldFeed({
      status: listing.status ?? "sold",
      title: listing.title,
      hidden_from_site: listing.hidden_from_site,
      archived_at: listing.archived_at,
    })
      ? listingDetailHref({ id: listing.id, slug: listing.slug })
      : null

  return {
    sold_price_usd: price,
    sold_at: row.created_at.slice(0, 10),
    condition: listing?.condition ?? null,
    condition_label: listing?.condition ? formatCondition(listing.condition) : null,
    dimensions: listing?.dimensions?.trim() || null,
    title: listing?.title?.trim() || null,
    listing_url: href ? absoluteUrl(href) : null,
  }
}
