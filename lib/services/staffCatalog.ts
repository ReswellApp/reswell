import { revalidatePath } from "next/cache"
import { revalidateNavSearchSuggest } from "@/lib/cache/revalidate-nav-search-suggest"
import { revalidateSellCatalogSearch } from "@/lib/cache/revalidate-sell-catalog-search"
import { getBrandById, getBrandBySlug, listBrands } from "@/lib/brands/server"
import { BRANDS_BASE } from "@/lib/brands/routes"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { syncBrandProductCategories } from "@/lib/db/brand-product-categories"
import { syncBrandToIndex } from "@/lib/elasticsearch/brands-index"
import { syncFinCatalogBrandToIndex } from "@/lib/elasticsearch/fin-catalog-index"
import { syncSellCatalogBrandToIndex } from "@/lib/elasticsearch/sell-catalog-index"
import { getDb } from "@/lib/supabase/db"
import type { BrandRow } from "@/lib/brands/types"

function staffDb() {
  return getDb({ consistency: "strong", purpose: "analytics" })
}

export type StaffBrandSummary = {
  id: string
  slug: string
  name: string
  short_description: string | null
  website_url: string | null
  logo_url: string | null
  founder_name: string | null
  lead_shaper_name: string | null
  location_label: string | null
  model_count: number
  product_categories: BrandProductCategorySlug[]
}

function toSummary(brand: BrandRow): StaffBrandSummary {
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    short_description: brand.short_description,
    website_url: brand.website_url,
    logo_url: brand.logo_url,
    founder_name: brand.founder_name,
    lead_shaper_name: brand.lead_shaper_name,
    location_label: brand.location_label,
    model_count: brand.model_count,
    product_categories: brand.product_categories,
  }
}

function revalidateBrandPaths(slug: string, previousSlug?: string) {
  revalidatePath(BRANDS_BASE)
  revalidatePath(`${BRANDS_BASE}/${slug}`)
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`${BRANDS_BASE}/${previousSlug}`)
  }
  revalidateNavSearchSuggest()
  revalidateSellCatalogSearch()
}

export async function staffListBrandsService(input: {
  query?: string
  limit: number
}): Promise<{ ok: true; brands: StaffBrandSummary[] } | { ok: false; error: string }> {
  const supabase = staffDb()
  try {
    const rows = await listBrands(supabase)
    const q = input.query?.trim().toLowerCase()
    let filtered = rows
    if (q) {
      filtered = rows.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.short_description?.toLowerCase().includes(q) ?? false),
      )
    }
    return {
      ok: true,
      brands: filtered.slice(0, input.limit).map(toSummary),
    }
  } catch (error) {
    console.error("[staff-mcp] list brands failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: "Could not list brands" }
  }
}

export async function staffGetBrandService(input: {
  brand_id?: string
  slug?: string
}): Promise<{ ok: true; brand: StaffBrandSummary } | { ok: false; error: string }> {
  const supabase = staffDb()
  const brand = input.brand_id
    ? await getBrandById(supabase, input.brand_id)
    : input.slug
      ? await getBrandBySlug(supabase, input.slug.trim().toLowerCase())
      : null
  if (!brand) return { ok: false, error: "Brand not found" }
  return { ok: true, brand: toSummary(brand) }
}

export async function staffCreateBrandService(input: {
  slug: string
  name: string
  short_description?: string | null
  website_url?: string | null
  logo_url?: string | null
  founder_name?: string | null
  lead_shaper_name?: string | null
  location_label?: string | null
  model_count?: number
  product_categories: BrandProductCategorySlug[]
}): Promise<
  | { ok: true; brand: StaffBrandSummary }
  | { ok: false; error: string; status?: number }
> {
  const supabase = staffDb()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("brands")
    .insert({
      slug: input.slug,
      name: input.name,
      short_description: input.short_description ?? null,
      website_url: input.website_url ?? null,
      logo_url: input.logo_url ?? null,
      founder_name: input.founder_name ?? null,
      lead_shaper_name: input.lead_shaper_name ?? null,
      location_label: input.location_label ?? null,
      model_count: input.model_count ?? 0,
      about_paragraphs: [],
      updated_at: now,
    })
    .select("id, slug")
    .single()

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "A brand with this slug already exists", status: 409 }
    }
    console.error("[staff-mcp] create brand failed", {
      timestamp: new Date().toISOString(),
      message: error?.message,
    })
    return { ok: false, error: error?.message ?? "Could not create brand", status: 500 }
  }

  const categorySync = await syncBrandProductCategories(
    supabase,
    data.id,
    input.product_categories,
  )
  if (!categorySync.ok) {
    await supabase.from("brands").delete().eq("id", data.id)
    return { ok: false, error: categorySync.error, status: 500 }
  }

  void syncBrandToIndex(supabase, data.id)
  void syncFinCatalogBrandToIndex(supabase, data.id)
  void syncSellCatalogBrandToIndex(supabase, data.id)
  revalidateBrandPaths(data.slug)

  const brand = await getBrandById(supabase, data.id)
  if (!brand) return { ok: false, error: "Brand created but could not be reloaded", status: 500 }
  return { ok: true, brand: toSummary(brand) }
}

export async function staffUpdateBrandService(input: {
  brand_id?: string
  slug?: string
  patch: {
    slug?: string
    name?: string
    short_description?: string | null
    website_url?: string | null
    logo_url?: string | null
    founder_name?: string | null
    lead_shaper_name?: string | null
    location_label?: string | null
    model_count?: number
    product_categories?: BrandProductCategorySlug[]
  }
}): Promise<
  | { ok: true; brand: StaffBrandSummary }
  | { ok: false; error: string; status?: number }
> {
  const supabase = staffDb()
  const existing = input.brand_id
    ? await getBrandById(supabase, input.brand_id)
    : input.slug
      ? await getBrandBySlug(supabase, input.slug.trim().toLowerCase())
      : null
  if (!existing) return { ok: false, error: "Brand not found", status: 404 }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.patch.slug !== undefined) updates.slug = input.patch.slug
  if (input.patch.name !== undefined) updates.name = input.patch.name
  if (input.patch.short_description !== undefined) {
    updates.short_description = input.patch.short_description
  }
  if (input.patch.website_url !== undefined) updates.website_url = input.patch.website_url
  if (input.patch.logo_url !== undefined) updates.logo_url = input.patch.logo_url
  if (input.patch.founder_name !== undefined) updates.founder_name = input.patch.founder_name
  if (input.patch.lead_shaper_name !== undefined) {
    updates.lead_shaper_name = input.patch.lead_shaper_name
  }
  if (input.patch.location_label !== undefined) updates.location_label = input.patch.location_label
  if (input.patch.model_count !== undefined) updates.model_count = input.patch.model_count

  const { error } = await supabase.from("brands").update(updates).eq("id", existing.id)
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A brand with this slug already exists", status: 409 }
    }
    console.error("[staff-mcp] update brand failed", {
      timestamp: new Date().toISOString(),
      brandId: existing.id,
      message: error.message,
    })
    return { ok: false, error: error.message, status: 500 }
  }

  if (input.patch.product_categories) {
    const categorySync = await syncBrandProductCategories(
      supabase,
      existing.id,
      input.patch.product_categories,
    )
    if (!categorySync.ok) {
      return { ok: false, error: categorySync.error, status: 500 }
    }
  }

  void syncBrandToIndex(supabase, existing.id)
  void syncFinCatalogBrandToIndex(supabase, existing.id)
  void syncSellCatalogBrandToIndex(supabase, existing.id)

  const brand = await getBrandById(supabase, existing.id)
  if (!brand) return { ok: false, error: "Brand updated but could not be reloaded", status: 500 }
  revalidateBrandPaths(brand.slug, existing.slug)
  return { ok: true, brand: toSummary(brand) }
}
