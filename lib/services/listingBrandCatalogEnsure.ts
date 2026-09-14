import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { isValidBrandSlug, slugifyBrandName } from "@/lib/brands/slug"
import { revalidateSellCatalogSearch } from "@/lib/cache/revalidate-sell-catalog-search"
import {
  deleteDirectoryBrand,
  fillEmptyDirectoryBrandFields,
  insertDirectoryBrand,
} from "@/lib/db/brands"
import { insertBrandModel } from "@/lib/db/brand-models"
import {
  listBrandProductCategoriesByBrandIds,
  syncBrandProductCategories,
} from "@/lib/db/brand-product-categories"
import {
  findDirectoryBrandBySlug,
  getDirectoryBrandProfile,
  type DirectoryBrandProfile,
} from "@/lib/db/listingBrandModelBackfill"
import { syncBrandToIndex } from "@/lib/elasticsearch/brands-index"
import { syncFinCatalogBrandToIndex } from "@/lib/elasticsearch/fin-catalog-index"
import {
  syncSellCatalogBrandToIndex,
  syncSellCatalogModelToIndex,
} from "@/lib/elasticsearch/sell-catalog-index"
import { labelsEqual } from "@/lib/utils/listing-brand-model-candidates"
import type { BrandMatchRow, ModelMatchRow } from "@/lib/utils/listing-brand-model-match"

export type EnsuredDirectoryBrand = DirectoryBrandProfile & { created: boolean }

async function mergeBrandProductCategories(
  supabase: SupabaseClient,
  brandId: string,
  nextCategories: readonly BrandProductCategorySlug[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existingMap = await listBrandProductCategoriesByBrandIds(supabase, [brandId])
  const existing = existingMap.get(brandId) ?? []
  const merged = [...new Set([...existing, ...nextCategories])]
  return syncBrandProductCategories(supabase, brandId, merged)
}

function indexNewBrand(supabase: SupabaseClient, brandId: string): void {
  void syncBrandToIndex(supabase, brandId)
  void syncFinCatalogBrandToIndex(supabase, brandId)
  void syncSellCatalogBrandToIndex(supabase, brandId)
  revalidateSellCatalogSearch()
}

/**
 * Find or create a directory brand. Never overwrites filled website / location /
 * founder / description. New rows require a valid slug and official https site.
 */
export async function ensureDirectoryBrandForListingCoverage(
  supabase: SupabaseClient,
  input: {
    name: string
    websiteUrl: string
    locationLabel: string | null
    founderName: string | null
    shortDescription: string | null
    categories: readonly BrandProductCategorySlug[]
    catalogBrands: BrandMatchRow[]
  },
): Promise<{ ok: true; brand: EnsuredDirectoryBrand } | { ok: false; error: string }> {
  const name = input.name.trim()
  const slug = slugifyBrandName(name)
  if (!name || !isValidBrandSlug(slug)) {
    return { ok: false, error: "Invalid brand name/slug" }
  }

  const bySlug = await findDirectoryBrandBySlug(supabase, slug)
  const byName = input.catalogBrands.find((b) => labelsEqual(b.name, name)) ?? null
  const existingId = bySlug?.id ?? byName?.id ?? null

  if (existingId) {
    await fillEmptyDirectoryBrandFields(supabase, existingId, {
      website_url: input.websiteUrl,
      location_label: input.locationLabel,
      founder_name: input.founderName,
      short_description: input.shortDescription,
    })
    const categorySync = await mergeBrandProductCategories(supabase, existingId, input.categories)
    if (!categorySync.ok) return categorySync
    const profile = await getDirectoryBrandProfile(supabase, existingId)
    if (!profile) return { ok: false, error: "Brand lookup failed after ensure" }
    return { ok: true, brand: { ...profile, created: false } }
  }

  const inserted = await insertDirectoryBrand(supabase, {
    slug,
    name,
    short_description: input.shortDescription,
    website_url: input.websiteUrl,
    founder_name: input.founderName,
    lead_shaper_name: input.founderName,
    location_label: input.locationLabel,
  })
  if (!inserted.ok) return inserted

  const categorySync = await mergeBrandProductCategories(
    supabase,
    inserted.row.id,
    input.categories,
  )
  if (!categorySync.ok) {
    await deleteDirectoryBrand(supabase, inserted.row.id)
    return categorySync
  }

  indexNewBrand(supabase, inserted.row.id)
  const profile = await getDirectoryBrandProfile(supabase, inserted.row.id)
  if (!profile) return { ok: false, error: "Brand created but could not be reloaded" }
  return { ok: true, brand: { ...profile, created: true } }
}

export async function ensureDirectoryModelForListingCoverage(
  supabase: SupabaseClient,
  input: {
    brandId: string
    name: string
    productCategorySlug: BrandProductCategorySlug
    existingModels: ModelMatchRow[]
  },
): Promise<
  | { ok: true; model: ModelMatchRow; created: boolean }
  | { ok: false; error: string }
> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Model name is required" }

  const existing = input.existingModels.find((m) => labelsEqual(m.name, name))
  if (existing) return { ok: true, model: existing, created: false }

  const inserted = await insertBrandModel(supabase, {
    brand_id: input.brandId,
    name,
    description: null,
    image_url: null,
    product_category_slug: input.productCategorySlug,
    board_category_slug: null,
  })
  if (!inserted.ok) {
    if (inserted.code === "23505") {
      const after = input.existingModels.find((m) => labelsEqual(m.name, name))
      if (after) return { ok: true, model: after, created: false }
    }
    return { ok: false, error: inserted.error }
  }

  void syncSellCatalogModelToIndex(supabase, inserted.row.id)
  revalidateSellCatalogSearch()
  return {
    ok: true,
    created: true,
    model: {
      id: inserted.row.id,
      brand_id: inserted.row.brand_id,
      name: inserted.row.name,
    },
  }
}
