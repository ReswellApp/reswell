import type { SupabaseClient } from "@supabase/supabase-js"
import { getBrandById } from "@/lib/brands/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deletePriceGuideEntry,
  getPriceGuideEntryById,
  getPriceGuideEntryByScope,
  insertPriceGuideEntry,
  listPriceGuideEntries,
  updatePriceGuideEntry,
} from "@/lib/db/price-guide-entries"
import {
  deletePriceGuideComp,
  insertPriceGuideComp,
  listPriceGuideCompsForEntries,
} from "@/lib/db/price-guide-comps"
import { searchPriceGuideCatalog, selectPriceGuideModelsForBrand } from "@/lib/db/price-guide-market"
import {
  type PriceGuideCategorySlug,
  priceGuideBrandHref,
  priceGuideCategoryHref,
  priceGuideCategoryLabel,
  priceGuideModelHref,
  priceGuideModelSlug,
} from "@/lib/price-guide/categories"
import { revalidatePriceGuide } from "@/lib/cache/revalidate-price-guide"
import {
  compsFromSales,
  conditionBandsFromSales,
  listingMatchesModel,
  loadPriceGuideMarketBundle,
  resolveConfidence,
  resolveListingModelName,
  resolveTypicalRange,
  toMarketStats,
} from "@/lib/services/priceGuideMarket"
import type {
  PriceGuideAdminCoverageRow,
  PriceGuideAdminDetail,
  PriceGuideAdminListItem,
  PriceGuideComp,
  PriceGuideCompSource,
  PriceGuideEntryRecord,
  PriceGuideStatus,
} from "@/lib/types/price-guide"

function marketDb(fallback: SupabaseClient): SupabaseClient {
  try {
    return createServiceRoleClient()
  } catch {
    return fallback
  }
}

function publicHrefForEntry(
  entry: PriceGuideEntryRecord,
  brandSlug: string | null,
  modelSlug: string | null,
): string {
  if (entry.brand_id && brandSlug && entry.brand_model_id && modelSlug) {
    return priceGuideModelHref(entry.category_slug, brandSlug, modelSlug)
  }
  if (entry.brand_id && brandSlug) {
    return priceGuideBrandHref(entry.category_slug, brandSlug)
  }
  return priceGuideCategoryHref(entry.category_slug)
}

export async function listPriceGuideAdminEntries(
  supabase: SupabaseClient,
  filters?: { status?: PriceGuideStatus | "all"; categorySlug?: PriceGuideCategorySlug; q?: string },
): Promise<PriceGuideAdminListItem[]> {
  const status = filters?.status && filters.status !== "all" ? filters.status : undefined
  const rows = await listPriceGuideEntries(supabase, {
    status,
    categorySlug: filters?.categorySlug,
  })

  const brandIds = [...new Set(rows.map((row) => row.brand_id).filter((id): id is string => Boolean(id)))]
  const modelIds = [
    ...new Set(rows.map((row) => row.brand_model_id).filter((id): id is string => Boolean(id))),
  ]

  const [brands, models] = await Promise.all([
    Promise.all(brandIds.map((id) => getBrandById(supabase, id))),
    Promise.all(
      modelIds.map(async (id) => {
        const { data } = await supabase.from("brand_models").select("id, name").eq("id", id).maybeSingle()
        return data as { id: string; name: string } | null
      }),
    ),
  ])

  const brandsById = new Map(
    brands.filter((row): row is NonNullable<typeof row> => Boolean(row)).map((row) => [row.id, row]),
  )
  const modelsById = new Map(
    models.filter((row): row is { id: string; name: string } => Boolean(row)).map((row) => [row.id, row]),
  )

  const q = filters?.q?.trim().toLowerCase() ?? ""
  const items: PriceGuideAdminListItem[] = []
  for (const entry of rows) {
    const brand = entry.brand_id ? brandsById.get(entry.brand_id) ?? null : null
    const model = entry.brand_model_id ? modelsById.get(entry.brand_model_id) ?? null : null
    const modelSlug = model ? priceGuideModelSlug(model.name) : null
    const haystack = `${brand?.name ?? ""} ${model?.name ?? ""} ${entry.headline ?? ""} ${entry.category_slug}`.toLowerCase()
    if (q && !haystack.includes(q)) continue
    items.push({
      ...entry,
      brand_name: brand?.name ?? null,
      brand_slug: brand?.slug ?? null,
      model_name: model?.name ?? null,
      public_href: publicHrefForEntry(entry, brand?.slug ?? null, modelSlug),
    })
  }
  return items
}

export async function createPriceGuideEntryService(
  supabase: SupabaseClient,
  input: {
    category_slug: PriceGuideCategorySlug
    brand_id?: string | null
    brand_model_id?: string | null
    created_by: string
  },
): Promise<
  { ok: true; row: PriceGuideEntryRecord } | { ok: false; error: string; status?: number }
> {
  const brandId = input.brand_id ?? null
  const modelId = input.brand_model_id ?? null
  if (modelId && !brandId) {
    return { ok: false, error: "A model guide needs a brand.", status: 400 }
  }
  if (modelId && brandId) {
    const { data: model } = await supabase
      .from("brand_models")
      .select("id, brand_id")
      .eq("id", modelId)
      .maybeSingle()
    if (!model || model.brand_id !== brandId) {
      return { ok: false, error: "Model does not belong to that brand.", status: 400 }
    }
  }

  const existing = await getPriceGuideEntryByScope(supabase, {
    categorySlug: input.category_slug,
    brandId,
    brandModelId: modelId,
  })
  if (existing) return { ok: true, row: existing }

  const created = await insertPriceGuideEntry(supabase, {
    category_slug: input.category_slug,
    brand_id: brandId,
    brand_model_id: modelId,
    created_by: input.created_by,
  })
  if (!created.ok) return created
  revalidatePriceGuide()
  return created
}

export async function updatePriceGuideEntryService(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
  reviewerId: string,
): Promise<{ ok: true; row: PriceGuideEntryRecord } | { ok: false; error: string }> {
  const next = { ...patch }
  if (next.mark_reviewed === true) {
    next.last_reviewed_at = new Date().toISOString()
    next.reviewed_by = reviewerId
  }
  delete next.mark_reviewed
  const updated = await updatePriceGuideEntry(supabase, id, next)
  if (updated.ok) revalidatePriceGuide()
  return updated
}

export async function deletePriceGuideEntryService(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deleted = await deletePriceGuideEntry(supabase, id)
  if (deleted.ok) revalidatePriceGuide()
  return deleted
}

export async function getPriceGuideAdminDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<PriceGuideAdminDetail | null> {
  const entry = await getPriceGuideEntryById(supabase, id)
  if (!entry) return null

  const brand = entry.brand_id ? await getBrandById(supabase, entry.brand_id) : null
  let modelName: string | null = null
  let modelSlug: string | null = null
  if (entry.brand_model_id) {
    const { data } = await supabase
      .from("brand_models")
      .select("id, name")
      .eq("id", entry.brand_model_id)
      .maybeSingle()
    if (data) {
      modelName = data.name
      modelSlug = priceGuideModelSlug(data.name)
    }
  }

  const bundle = await loadPriceGuideMarketBundle(marketDb(supabase), {
    section: entry.category_slug,
    brandId: entry.brand_id ?? undefined,
  })

  let listings = bundle.listings
  let sales = bundle.sales
  if (entry.brand_model_id && modelSlug) {
    listings = listings.filter((listing) =>
      listingMatchesModel(listing, bundle.snapshotsByListingId.get(listing.id), {
        id: entry.brand_model_id,
        slug: modelSlug,
        name: modelName ?? modelSlug,
      }),
    )
    const ids = new Set(listings.map((row) => row.id))
    sales = sales.filter((sale) => ids.has(sale.listingId))
  } else if (entry.brand_id) {
    listings = listings.filter((listing) => listing.brand_id === entry.brand_id)
    const ids = new Set(listings.map((row) => row.id))
    sales = sales.filter((sale) => ids.has(sale.listingId))
  }

  const stats = toMarketStats(listings, sales)
  const comps = (await listPriceGuideCompsForEntries(supabase, [entry.id], false)).get(entry.id) ?? []

  return {
    entry,
    scope: {
      category_slug: entry.category_slug,
      category_label: priceGuideCategoryLabel(entry.category_slug),
      brand: brand
        ? { id: brand.id, name: brand.name, slug: brand.slug, logo_url: brand.logo_url }
        : null,
      model: entry.brand_model_id && modelName && modelSlug
        ? { id: entry.brand_model_id, name: modelName, slug: modelSlug }
        : null,
    },
    market: {
      asking: stats.asking,
      sold: stats.sold,
      typical: resolveTypicalRange(stats.asking, stats.sold, null),
      confidence: resolveConfidence(stats.sold.count, stats.asking.count, null),
      condition_bands: conditionBandsFromSales(sales),
      recent_sold: compsFromSales(sales, 20),
    },
    comps,
    public_href: publicHrefForEntry(entry, brand?.slug ?? null, modelSlug),
  }
}

export async function addPriceGuideCompService(
  supabase: SupabaseClient,
  entryId: string,
  input: {
    sold_price_usd: number
    sold_at: string
    condition: string | null
    dimensions: string | null
    title: string | null
    source: PriceGuideCompSource
    source_url: string | null
    notes: string | null
    include_in_public: boolean
    listing_id?: string | null
    created_by: string
  },
): Promise<{ ok: true; row: PriceGuideComp } | { ok: false; error: string }> {
  const entry = await getPriceGuideEntryById(supabase, entryId)
  if (!entry) return { ok: false, error: "Guide entry not found" }
  const created = await insertPriceGuideComp(supabase, {
    entry_id: entryId,
    sold_price_usd: input.sold_price_usd,
    sold_at: input.sold_at,
    condition: input.condition,
    dimensions: input.dimensions,
    title: input.title,
    source: input.source,
    source_url: input.source_url,
    notes: input.notes,
    include_in_public: input.include_in_public,
    listing_id: input.listing_id ?? null,
    created_by: input.created_by,
  })
  if (created.ok) revalidatePriceGuide()
  return created
}

export async function deletePriceGuideCompService(
  supabase: SupabaseClient,
  compId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deleted = await deletePriceGuideComp(supabase, compId)
  if (deleted.ok) revalidatePriceGuide()
  return deleted
}

export async function getPriceGuideCoverage(
  supabase: SupabaseClient,
  category: PriceGuideCategorySlug,
): Promise<PriceGuideAdminCoverageRow[]> {
  const [bundle, entries] = await Promise.all([
    loadPriceGuideMarketBundle(marketDb(supabase), { section: category }),
    listPriceGuideEntries(supabase, { categorySlug: category }),
  ])

  const entryByScope = new Map<string, PriceGuideEntryRecord>()
  for (const entry of entries) {
    entryByScope.set(`${entry.brand_id ?? ""}:${entry.brand_model_id ?? ""}`, entry)
  }

  const groups = new Map<
    string,
    {
      brandId: string
      modelId: string | null
      modelName: string | null
      modelSlug: string | null
      listings: typeof bundle.listings
    }
  >()

  for (const listing of bundle.listings) {
    if (!listing.brand_id) continue
    const model = resolveListingModelName(
      listing,
      bundle.snapshotsByListingId.get(listing.id),
      bundle.modelsById,
    )
    const key = `${listing.brand_id}:${model?.id ?? model?.slug ?? ""}`
    const existing = groups.get(key)
    if (existing) existing.listings.push(listing)
    else {
      groups.set(key, {
        brandId: listing.brand_id,
        modelId: model?.id ?? listing.brand_model_id,
        modelName: model?.name ?? null,
        modelSlug: model?.slug ?? null,
        listings: [listing],
      })
    }
  }

  const rows: PriceGuideAdminCoverageRow[] = []
  for (const group of groups.values()) {
    const brand = bundle.brandsById.get(group.brandId)
    if (!brand) continue
    const ids = new Set(group.listings.map((row) => row.id))
    const sales = bundle.sales.filter((sale) => ids.has(sale.listingId))
    const stats = toMarketStats(group.listings, sales)
    if (stats.sold.count === 0 && stats.asking.count < 2) continue
    const entry =
      entryByScope.get(`${group.brandId}:${group.modelId ?? ""}`) ??
      (group.modelId ? null : entryByScope.get(`${group.brandId}:`)) ??
      null
    rows.push({
      category_slug: category,
      brand_id: brand.id,
      brand_name: brand.name,
      brand_slug: brand.slug,
      brand_model_id: group.modelId,
      model_name: group.modelName,
      model_slug: group.modelSlug,
      sold_count: stats.sold.count,
      asking_count: stats.asking.count,
      mid_usd: resolveTypicalRange(stats.asking, stats.sold, entry).mid_usd,
      entry_id: entry?.id ?? null,
      entry_status: entry?.status ?? null,
    })
  }

  rows.sort((a, b) => {
    const aCovered = a.entry_id ? 1 : 0
    const bCovered = b.entry_id ? 1 : 0
    if (aCovered !== bCovered) return aCovered - bCovered
    return b.sold_count * 2 + b.asking_count - (a.sold_count * 2 + a.asking_count)
  })
  return rows.slice(0, 80)
}

export async function searchPriceGuideAdminCatalog(
  supabase: SupabaseClient,
  q: string,
): Promise<{
  brands: Array<{ id: string; name: string; slug: string; logo_url: string | null }>
  models: Array<{
    id: string
    name: string
    brand_id: string
    brand_name: string
    brand_slug: string
    product_category_slug: string | null
  }>
}> {
  return searchPriceGuideCatalog(supabase, q)
}

export async function listModelsForAdminBrand(
  supabase: SupabaseClient,
  brandId: string,
) {
  return selectPriceGuideModelsForBrand(supabase, brandId)
}
