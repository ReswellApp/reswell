"use server"

import { createClient } from "@/lib/supabase/server"
import { listBrandModelsWithBrandsForSellCatalog } from "@/lib/db/brand-models"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { listBrands } from "@/lib/brands/server"
import {
  resolveDirectoryBrandRowFromLabel,
  searchBrandsCatalogSuggestWithClient,
  type BrandCatalogSuggestResponse,
} from "@/lib/services/brandDirectorySearch"
import { runMarketplaceSearchSuggest } from "@/lib/services/marketplaceSearchSuggest"
import { slugify } from "@/lib/slugify"
import type { SearchSuggestResult } from "@/lib/types/marketplace-search-suggest"

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

export type {
  SearchSuggestBrandChip,
  SearchSuggestMeta,
  SearchSuggestResult,
  SuggestListing,
} from "@/lib/types/marketplace-search-suggest"

export async function searchSuggest(qRaw: string, section: string): Promise<SearchSuggestResult> {
  const supabase = await createClient()
  return runMarketplaceSearchSuggest(supabase, qRaw, section)
}

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
