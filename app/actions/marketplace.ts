"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { listBrandModelsWithBrandsForSellCatalog } from "@/lib/db/brand-models"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { searchListingIdsFromElasticsearch } from "@/lib/elasticsearch/listings-index"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { listBrands } from "@/lib/brands/server"
import {
  resolveDirectoryBrandRowFromLabel,
  searchBrandsCatalogSuggestWithClient,
  type BrandCatalogSuggestResponse,
  type BrandCatalogSuggestRow,
} from "@/lib/services/brandDirectorySearch"
import { slugify } from "@/lib/slugify"

export async function getDistinctBrandsFromListings(section: string): Promise<string[]> {
  const sections = section === "new" ? ["new"] : ["surfboards"]

  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("brand")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .in("section", sections)
    .not("brand", "is", null)

  const set = new Set<string>()
  return (data || [])
    .map((r) => r.brand?.trim())
    .filter((b): b is string => !!b && b.length > 0)
    .filter((b) => {
      const key = b.toLowerCase()
      if (set.has(key)) return false
      set.add(key)
      return true
    })
    .sort((a, b) => a.localeCompare(b))
}

export type InventoryProductRow = {
  id: string
  name: string
  price: number
  image_url: string | null
  stock_quantity: number
}

export async function getInventoryProductById(
  id: string,
): Promise<{ product: InventoryProductRow } | { error: string }> {
  const supabase = await createClient()
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, price, stock_quantity, listing_images (url, is_primary)")
    .eq("id", id)
    .eq("section", "new")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .maybeSingle()

  if (error || !listing) {
    return { error: "Product not found" }
  }

  const stockQty = Number((listing as { stock_quantity?: number }).stock_quantity) || 0
  if (stockQty <= 0) {
    return { error: "Product not found" }
  }

  const images =
    (listing.listing_images as { url: string; is_primary: boolean }[] | null) || []
  const primary = images.find((i) => i.is_primary) || images[0]

  return {
    product: {
      id: listing.id,
      name: listing.title,
      price: Number(listing.price),
      image_url: primary?.url ?? null,
      stock_quantity: stockQty,
    },
  }
}

export async function getBoardModelsCatalogItems() {
  const supabase = await createClient()
  const brands = await listBrands(supabase)
  const items = brands.map((b) => ({
    brandId: b.id,
    brandSlug: b.slug,
    modelSlug: "",
    brandName: b.name,
    modelName: "",
    label: b.name,
  }))
  return { items }
}

export type SellBrandModelCatalogRow = {
  id: string
  name: string
  catalogSlug: string
  brandId: string
  brandName: string
  brandSlug: string
}

/**
 * All surfboard models in `brand_models` with directory brands (excludes variants) for `/sell` model search.
 */
export async function getBrandModelsCatalogForSellForm(): Promise<
  | { ok: true; models: SellBrandModelCatalogRow[] }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient()
    const rows = await listBrandModelsWithBrandsForSellCatalog(supabase)
    return {
      ok: true,
      models: rows.map((r) => ({
        id: r.id,
        name: r.name,
        catalogSlug: slugify(r.name),
        brandId: r.brandId,
        brandName: r.brandName,
        brandSlug: r.brandSlug,
      })),
    }
  } catch (e) {
    console.error("getBrandModelsCatalogForSellForm:", e)
    return { ok: false, error: "Could not load model catalog." }
  }
}

/** Returned to the client after dedupe / slice */
const MAX_TITLES = 20
const MAX_CATEGORIES = 12
const MAX_BRANDS = 16
const MAX_LISTINGS = 12
const TITLE_SUGGEST_FETCH = 80

export type SuggestListing = {
  id: string
  slug: string | null
  title: string
  price: number
  section: string
  imageUrl: string | null
  brand: string | null
  city: string | null
  state: string | null
  condition: string | null
}

export type SearchSuggestMeta = {
  /** How the “Top listings” strip was populated when suggestions ran. */
  listingsBackend: "elasticsearch" | "supabase"
}

export type SearchSuggestResult = {
  titles: string[]
  categories: string[]
  brands: string[]
  listings: SuggestListing[]
  meta: SearchSuggestMeta
}

function escapeIlikeToken(q: string) {
  return q.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function rowToSuggestListing(row: Record<string, unknown>): SuggestListing {
  const imgs = row.listing_images as { url?: string; is_primary?: boolean }[] | null
  const primary = imgs?.find((i) => i.is_primary) || imgs?.[0]
  return {
    id: row.id as string,
    slug: (row.slug as string | null) ?? null,
    title: (row.title as string) ?? "",
    price: typeof row.price === "number" ? row.price : parseFloat(String(row.price)) || 0,
    section: row.section as string,
    imageUrl: primary?.url ?? null,
    brand: (row.brand as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    state: (row.state as string | null) ?? null,
    condition: (row.condition as string | null) ?? null,
  }
}

export async function searchSuggest(qRaw: string, section: string): Promise<SearchSuggestResult> {
  const q = (qRaw || "").trim().replace(/%/g, "")
  if (!q || q.length < 2) {
    return {
      titles: [],
      categories: [],
      brands: [],
      listings: [],
      meta: { listingsBackend: "supabase" },
    }
  }

  const supabase = await createClient()
  const safe = escapeIlikeToken(q)
  const pattern = `"%${safe}%"`
  const sections = section === "new" ? ["new"] : ["surfboards"]

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
        listing_images (url, is_primary)
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
      .select("brand")
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
            listing_images (url, is_primary)
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

  const brandSet = new Set<string>()
  const brands = (brandsRes.data || [])
    .map((r) => r.brand?.trim())
    .filter((b): b is string => !!b && b.length > 0)
    .filter((b) => {
      const k = b.toLowerCase()
      if (brandSet.has(k)) return false
      brandSet.add(k)
      return true
    })
    .slice(0, MAX_BRANDS)

  return { titles, categories, brands, listings, meta: { listingsBackend } }
}

export type { BrandCatalogSuggestResponse, BrandCatalogSuggestRow }

/**
 * Search the official brand directory (not listing-derived brand text).
 * Used by the sell form brand field (`BrandInputWithSuggestions`) and nav-style brand typeahead.
 */
export async function searchBrandsCatalogSuggest(
  qRaw: string,
): Promise<BrandCatalogSuggestResponse> {
  const supabase = await createClient()
  return searchBrandsCatalogSuggestWithClient(supabase, qRaw)
}

/**
 * Resolve a nav brand-chip label (listing-derived text) to a directory profile path.
 */
export async function resolveBrandProfilePathFromNavLabel(rawLabel: string): Promise<string | null> {
  const name = (rawLabel || "").trim()
  if (!name) return null

  const supabase = await createClient()
  const row = await resolveDirectoryBrandRowFromLabel(supabase, name)
  return row ? `${BRANDS_BASE}/${row.slug}` : null
}
