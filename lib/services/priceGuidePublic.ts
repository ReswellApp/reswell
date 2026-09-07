import type { SupabaseClient } from "@supabase/supabase-js"
import { getBrandBySlug } from "@/lib/brands/server"
import {
  getPriceGuideEntryByScope,
  listPriceGuideEntries,
  listPublishedFeaturedPriceGuideEntries,
} from "@/lib/db/price-guide-entries"
import { listPriceGuideCompsForEntries } from "@/lib/db/price-guide-comps"
import { selectPriceGuideModelsForBrand } from "@/lib/db/price-guide-market"
import {
  type PriceGuideCategorySlug,
  PRICE_GUIDE_CATEGORY_SLUGS,
  priceGuideBrandHref,
  priceGuideBrowseHref,
  priceGuideCategoryBlurb,
  priceGuideCategoryHref,
  priceGuideCategoryLabel,
  priceGuideHubHref,
  priceGuideModelHref,
  priceGuideModelSlug,
  priceGuideSellHref,
} from "@/lib/price-guide/categories"
import {
  compsFromSales,
  conditionBandsFromSales,
  listingMatchesModel,
  loadLiveListingsForScope,
  loadPriceGuideMarketBundle,
  mergeComps,
  mergeConditionBands,
  resolveConfidence,
  resolveListingBrand,
  resolveListingModelName,
  resolveTypicalRange,
  toMarketStats,
  type PriceGuideMarketBundle,
  type PriceGuideResolvedSale,
} from "@/lib/services/priceGuideMarket"
import type { PriceGuideListingRow } from "@/lib/db/price-guide-market"
import type {
  PriceGuideBrandPage,
  PriceGuideBrandRow,
  PriceGuideCategoryCard,
  PriceGuideCategoryPage,
  PriceGuideComp,
  PriceGuideEntryRecord,
  PriceGuideFeaturedModel,
  PriceGuideHub,
  PriceGuideModelPage,
  PriceGuideModelRow,
  PriceGuideSearchHit,
} from "@/lib/types/price-guide"

function filterBundle(
  bundle: PriceGuideMarketBundle,
  pred: (listing: PriceGuideListingRow) => boolean,
): { listings: PriceGuideListingRow[]; sales: PriceGuideResolvedSale[] } {
  const listings = bundle.listings.filter(pred)
  const ids = new Set(listings.map((row) => row.id))
  return {
    listings,
    sales: bundle.sales.filter((sale) => ids.has(sale.listingId)),
  }
}

function modelRowsFromSubset(
  category: PriceGuideCategorySlug,
  brandSlug: string,
  listings: PriceGuideListingRow[],
  sales: PriceGuideResolvedSale[],
  bundle: PriceGuideMarketBundle,
  entriesByModelId: Map<string, PriceGuideEntryRecord>,
): PriceGuideModelRow[] {
  const groups = new Map<
    string,
    { id: string | null; name: string; slug: string; listings: PriceGuideListingRow[] }
  >()

  for (const listing of listings) {
    const snap = bundle.snapshotsByListingId.get(listing.id)
    const model = resolveListingModelName(listing, snap, bundle.modelsById)
    if (!model) continue
    const existing = groups.get(model.slug)
    if (existing) {
      existing.listings.push(listing)
      if (!existing.id && model.id) existing.id = model.id
    } else {
      groups.set(model.slug, { ...model, listings: [listing] })
    }
  }

  const rows: PriceGuideModelRow[] = []
  for (const group of groups.values()) {
    const ids = new Set(group.listings.map((row) => row.id))
    const groupSales = sales.filter((sale) => ids.has(sale.listingId))
    const stats = toMarketStats(group.listings, groupSales)
    const entry = group.id ? entriesByModelId.get(group.id) ?? null : null
    rows.push({
      model_id: group.id,
      model_name: group.name,
      model_slug: group.slug,
      href: priceGuideModelHref(category, brandSlug, group.slug),
      typical: resolveTypicalRange(stats.asking, stats.sold, entry),
      asking: stats.asking,
      sold: stats.sold,
      confidence: resolveConfidence(stats.sold.count, stats.asking.count, entry),
    })
  }

  rows.sort((a, b) => {
    const aScore = a.sold.count * 2 + a.asking.count
    const bScore = b.sold.count * 2 + b.asking.count
    if (bScore !== aScore) return bScore - aScore
    return a.model_name.localeCompare(b.model_name)
  })
  return rows
}

export async function getPriceGuideHub(supabase: SupabaseClient): Promise<PriceGuideHub> {
  const [bundle, featuredEntries, publishedEntries] = await Promise.all([
    loadPriceGuideMarketBundle(supabase),
    listPublishedFeaturedPriceGuideEntries(supabase, 12),
    listPriceGuideEntries(supabase, { status: "published" }),
  ])

  const publishedByScope = new Map<string, PriceGuideEntryRecord>()
  for (const entry of publishedEntries) {
    publishedByScope.set(
      `${entry.category_slug}:${entry.brand_id ?? ""}:${entry.brand_model_id ?? ""}`,
      entry,
    )
  }

  const categories: PriceGuideCategoryCard[] = PRICE_GUIDE_CATEGORY_SLUGS.map((slug) => {
    const subset = filterBundle(bundle, (row) => row.section === slug)
    const stats = toMarketStats(subset.listings, subset.sales)
    const entry = publishedByScope.get(`${slug}::`) ?? null
    const brandIds = new Set(
      subset.listings.map((row) => row.brand_id).filter((id): id is string => Boolean(id)),
    )
    return {
      slug,
      label: priceGuideCategoryLabel(slug),
      blurb: priceGuideCategoryBlurb(slug),
      href: priceGuideCategoryHref(slug),
      browse_href: priceGuideBrowseHref(slug),
      asking: stats.asking,
      sold: stats.sold,
      typical: resolveTypicalRange(stats.asking, stats.sold, entry),
      brand_count: brandIds.size,
      listing_count: stats.asking.count,
    }
  })

  const surfboards = categories.find((card) => card.slug === "surfboards")
  const brandIds = new Set(
    bundle.listings.map((row) => row.brand_id).filter((id): id is string => Boolean(id)),
  )
  const modelKeys = new Set<string>()
  for (const listing of bundle.listings) {
    const model = resolveListingModelName(
      listing,
      bundle.snapshotsByListingId.get(listing.id),
      bundle.modelsById,
    )
    if (model) modelKeys.add(`${listing.brand_id ?? listing.brand ?? ""}:${model.slug}`)
  }

  const featured = buildFeaturedModels(bundle, featuredEntries, publishedByScope)
  const searchIndex = buildSearchIndex(bundle, categories)
  const entryIds = featuredEntries.map((entry) => entry.id)
  const manualByEntry = await listPriceGuideCompsForEntries(supabase, entryIds, true)
  const featuredManual = featuredEntries.flatMap((entry) => manualByEntry.get(entry.id) ?? [])

  return {
    generated_at: new Date().toISOString(),
    pulse: {
      active_listings: bundle.listings.filter(
        (row) => row.status === "active" || row.status === "pending_sale",
      ).length,
      sold_comps: bundle.sales.length + featuredManual.length,
      brands_covered: brandIds.size,
      models_covered: modelKeys.size,
      median_surfboard_usd: surfboards?.typical.mid_usd ?? null,
    },
    categories,
    featured,
    recent_sold: mergeComps(compsFromSales(bundle.sales, 16), featuredManual, 12),
    search_index: searchIndex,
  }
}

function buildFeaturedModels(
  bundle: PriceGuideMarketBundle,
  featuredEntries: PriceGuideEntryRecord[],
  publishedByScope: Map<string, PriceGuideEntryRecord>,
): PriceGuideFeaturedModel[] {
  const out: PriceGuideFeaturedModel[] = []
  const seen = new Set<string>()

  for (const entry of featuredEntries) {
    if (!entry.brand_id || !entry.brand_model_id) continue
    const brand = bundle.brandsById.get(entry.brand_id)
    const model = bundle.modelsById.get(entry.brand_model_id)
    if (!brand || !model) continue
    const modelSlug = priceGuideModelSlug(model.name)
    const subset = filterBundle(bundle, (listing) => {
      if (listing.section !== entry.category_slug) return false
      if (listing.brand_id !== brand.id) return false
      return listingMatchesModel(
        listing,
        bundle.snapshotsByListingId.get(listing.id),
        { id: model.id, slug: modelSlug, name: model.name },
      )
    })
    const stats = toMarketStats(subset.listings, subset.sales)
    const key = `${entry.category_slug}:${brand.slug}:${modelSlug}`
    seen.add(key)
    out.push({
      href: priceGuideModelHref(entry.category_slug, brand.slug, modelSlug),
      brand_name: brand.name,
      brand_slug: brand.slug,
      model_name: model.name,
      category_slug: entry.category_slug,
      typical: resolveTypicalRange(stats.asking, stats.sold, entry),
      sold_count: stats.sold.count,
      asking_count: stats.asking.count,
      confidence: resolveConfidence(stats.sold.count, stats.asking.count, entry),
      image_url: model.image_url ?? brand.logo_url,
    })
  }

  const scored: PriceGuideFeaturedModel[] = []
  const groups = new Map<string, { listing: PriceGuideListingRow; modelName: string; modelSlug: string }[]>()
  for (const listing of bundle.listings) {
    const brand = resolveListingBrand(listing, bundle.snapshotsByListingId.get(listing.id), bundle.brandsById)
    const model = resolveListingModelName(
      listing,
      bundle.snapshotsByListingId.get(listing.id),
      bundle.modelsById,
    )
    if (!brand || !model) continue
    const key = `${listing.section}:${brand.slug}:${model.slug}`
    const list = groups.get(key) ?? []
    list.push({ listing, modelName: model.name, modelSlug: model.slug })
    groups.set(key, list)
  }

  for (const [key, rows] of groups) {
    if (seen.has(key)) continue
    const [category, brandSlug, modelSlug] = key.split(":")
    if (!isCategory(category) || !brandSlug || !modelSlug) continue
    const listings = rows.map((row) => row.listing)
    const ids = new Set(listings.map((row) => row.id))
    const sales = bundle.sales.filter((sale) => ids.has(sale.listingId))
    if (sales.length < 1 && listings.length < 3) continue
    const brand = resolveListingBrand(
      listings[0]!,
      bundle.snapshotsByListingId.get(listings[0]!.id),
      bundle.brandsById,
    )
    if (!brand) continue
    const stats = toMarketStats(listings, sales)
    const modelId = listings.find((row) => row.brand_model_id)?.brand_model_id ?? null
    const entry = modelId
      ? publishedByScope.get(`${category}:${brand.id}:${modelId}`) ?? null
      : null
    scored.push({
      href: priceGuideModelHref(category, brand.slug, modelSlug),
      brand_name: brand.name,
      brand_slug: brand.slug,
      model_name: rows[0]!.modelName,
      category_slug: category,
      typical: resolveTypicalRange(stats.asking, stats.sold, entry),
      sold_count: stats.sold.count,
      asking_count: stats.asking.count,
      confidence: resolveConfidence(stats.sold.count, stats.asking.count, entry),
      image_url: (modelId ? bundle.modelsById.get(modelId)?.image_url : null) ?? brand.logo_url,
    })
  }

  scored.sort((a, b) => b.sold_count * 3 + b.asking_count - (a.sold_count * 3 + a.asking_count))
  for (const row of scored) {
    if (out.length >= 8) break
    out.push(row)
  }

  return out.slice(0, 8)
}

function isCategory(value: string): value is PriceGuideCategorySlug {
  return (PRICE_GUIDE_CATEGORY_SLUGS as readonly string[]).includes(value)
}

function buildSearchIndex(
  bundle: PriceGuideMarketBundle,
  categories: PriceGuideCategoryCard[],
): PriceGuideSearchHit[] {
  const hits: PriceGuideSearchHit[] = categories.map((card) => ({
    kind: "category",
    label: card.label,
    sublabel: "Category",
    href: card.href,
    mid_usd: card.typical.mid_usd,
    sold_count: card.sold.count,
    asking_count: card.asking.count,
  }))

  const byBrand = new Map<
    string,
    { brandId: string; slug: string; name: string; category: PriceGuideCategorySlug; listings: PriceGuideListingRow[] }
  >()
  for (const listing of bundle.listings) {
    const brand = resolveListingBrand(listing, bundle.snapshotsByListingId.get(listing.id), bundle.brandsById)
    if (!brand) continue
    const key = `${listing.section}:${brand.id}`
    const existing = byBrand.get(key)
    if (existing) existing.listings.push(listing)
    else {
      byBrand.set(key, {
        brandId: brand.id,
        slug: brand.slug,
        name: brand.name,
        category: listing.section as PriceGuideCategorySlug,
        listings: [listing],
      })
    }
  }

  const brandHits: PriceGuideSearchHit[] = []
  for (const group of byBrand.values()) {
    const ids = new Set(group.listings.map((row) => row.id))
    const sales = bundle.sales.filter((sale) => ids.has(sale.listingId))
    const stats = toMarketStats(group.listings, sales)
    brandHits.push({
      kind: "brand",
      label: group.name,
      sublabel: priceGuideCategoryLabel(group.category),
      href: priceGuideBrandHref(group.category, group.slug),
      mid_usd: resolveTypicalRange(stats.asking, stats.sold, null).mid_usd,
      sold_count: stats.sold.count,
      asking_count: stats.asking.count,
    })
  }
  brandHits.sort((a, b) => b.sold_count * 2 + b.asking_count - (a.sold_count * 2 + a.asking_count))
  hits.push(...brandHits.slice(0, 80))

  const byModel = new Map<
    string,
    {
      brandSlug: string
      brandName: string
      category: PriceGuideCategorySlug
      modelName: string
      modelSlug: string
      listings: PriceGuideListingRow[]
    }
  >()
  for (const listing of bundle.listings) {
    const brand = resolveListingBrand(listing, bundle.snapshotsByListingId.get(listing.id), bundle.brandsById)
    const model = resolveListingModelName(
      listing,
      bundle.snapshotsByListingId.get(listing.id),
      bundle.modelsById,
    )
    if (!brand || !model) continue
    const key = `${listing.section}:${brand.slug}:${model.slug}`
    const existing = byModel.get(key)
    if (existing) existing.listings.push(listing)
    else {
      byModel.set(key, {
        brandSlug: brand.slug,
        brandName: brand.name,
        category: listing.section as PriceGuideCategorySlug,
        modelName: model.name,
        modelSlug: model.slug,
        listings: [listing],
      })
    }
  }

  const modelHits: PriceGuideSearchHit[] = []
  for (const group of byModel.values()) {
    const ids = new Set(group.listings.map((row) => row.id))
    const sales = bundle.sales.filter((sale) => ids.has(sale.listingId))
    if (sales.length === 0 && group.listings.length < 2) continue
    const stats = toMarketStats(group.listings, sales)
    modelHits.push({
      kind: "model",
      label: `${group.brandName} ${group.modelName}`,
      sublabel: priceGuideCategoryLabel(group.category),
      href: priceGuideModelHref(group.category, group.brandSlug, group.modelSlug),
      mid_usd: resolveTypicalRange(stats.asking, stats.sold, null).mid_usd,
      sold_count: stats.sold.count,
      asking_count: stats.asking.count,
    })
  }
  modelHits.sort((a, b) => b.sold_count * 3 + b.asking_count - (a.sold_count * 3 + a.asking_count))
  hits.push(...modelHits.slice(0, 160))
  return hits
}

export async function getPriceGuideCategoryPage(
  supabase: SupabaseClient,
  category: PriceGuideCategorySlug,
): Promise<PriceGuideCategoryPage> {
  const [bundle, entry, published] = await Promise.all([
    loadPriceGuideMarketBundle(supabase, { section: category }),
    getPriceGuideEntryByScope(supabase, {
      categorySlug: category,
      brandId: null,
      brandModelId: null,
    }),
    listPriceGuideEntries(supabase, { status: "published", categorySlug: category }),
  ])

  const publishedByModel = new Map<string, PriceGuideEntryRecord>()
  const publishedByBrand = new Map<string, PriceGuideEntryRecord>()
  for (const row of published) {
    if (row.brand_id && row.brand_model_id) publishedByModel.set(row.brand_model_id, row)
    else if (row.brand_id && !row.brand_model_id) publishedByBrand.set(row.brand_id, row)
  }

  const stats = toMarketStats(bundle.listings, bundle.sales)
  const byBrand = new Map<string, PriceGuideListingRow[]>()
  for (const listing of bundle.listings) {
    const brand = resolveListingBrand(listing, bundle.snapshotsByListingId.get(listing.id), bundle.brandsById)
    if (!brand) continue
    const list = byBrand.get(brand.id) ?? []
    list.push(listing)
    byBrand.set(brand.id, list)
  }

  const brands: PriceGuideBrandRow[] = []
  for (const [brandId, listings] of byBrand) {
    const brand = bundle.brandsById.get(brandId)
    if (!brand) continue
    const ids = new Set(listings.map((row) => row.id))
    const sales = bundle.sales.filter((sale) => ids.has(sale.listingId))
    const brandStats = toMarketStats(listings, sales)
    const entryForBrand = publishedByBrand.get(brandId) ?? null
    const models = new Set<string>()
    for (const listing of listings) {
      const model = resolveListingModelName(
        listing,
        bundle.snapshotsByListingId.get(listing.id),
        bundle.modelsById,
      )
      if (model) models.add(model.slug)
    }
    brands.push({
      brand_id: brand.id,
      brand_name: brand.name,
      brand_slug: brand.slug,
      logo_url: brand.logo_url,
      href: priceGuideBrandHref(category, brand.slug),
      typical: resolveTypicalRange(brandStats.asking, brandStats.sold, entryForBrand),
      asking: brandStats.asking,
      sold: brandStats.sold,
      model_count: models.size,
      confidence: resolveConfidence(brandStats.sold.count, brandStats.asking.count, entryForBrand),
    })
  }
  brands.sort((a, b) => b.sold.count * 2 + b.asking.count - (a.sold.count * 2 + a.asking.count))

  const topModels: PriceGuideModelRow[] = []
  for (const brand of brands.slice(0, 12)) {
    const listings = byBrand.get(brand.brand_id) ?? []
    const ids = new Set(listings.map((row) => row.id))
    const sales = bundle.sales.filter((sale) => ids.has(sale.listingId))
    topModels.push(
      ...modelRowsFromSubset(category, brand.brand_slug, listings, sales, bundle, publishedByModel),
    )
  }
  topModels.sort((a, b) => b.sold.count * 2 + b.asking.count - (a.sold.count * 2 + a.asking.count))

  const publicEntry = entry?.status === "published" ? entry : null
  const manual = publicEntry
    ? (await listPriceGuideCompsForEntries(supabase, [publicEntry.id], true)).get(publicEntry.id) ?? []
    : []

  return {
    category_slug: category,
    category_label: priceGuideCategoryLabel(category),
    blurb: publicEntry?.summary ?? priceGuideCategoryBlurb(category),
    browse_href: priceGuideBrowseHref(category),
    sell_href: priceGuideSellHref(category),
    typical: resolveTypicalRange(stats.asking, stats.sold, publicEntry),
    asking: stats.asking,
    sold: stats.sold,
    confidence: resolveConfidence(stats.sold.count, stats.asking.count, publicEntry),
    entry: publicEntry,
    brands: brands.slice(0, 40),
    top_models: topModels.slice(0, 16),
    recent_sold: mergeComps(compsFromSales(bundle.sales, 16), manual, 12),
  }
}

export async function getPriceGuideBrandPage(
  supabase: SupabaseClient,
  category: PriceGuideCategorySlug,
  brandSlug: string,
): Promise<PriceGuideBrandPage | null> {
  const brand = await getBrandBySlug(supabase, brandSlug)
  if (!brand) return null

  const [bundle, entry, catalogModels, published] = await Promise.all([
    loadPriceGuideMarketBundle(supabase, { section: category, brandId: brand.id }),
    getPriceGuideEntryByScope(supabase, {
      categorySlug: category,
      brandId: brand.id,
      brandModelId: null,
    }),
    selectPriceGuideModelsForBrand(supabase, brand.id),
    listPriceGuideEntries(supabase, { status: "published", categorySlug: category }),
  ])

  if (bundle.listings.length === 0 && catalogModels.length === 0 && !entry) return null

  const publishedByModel = new Map<string, PriceGuideEntryRecord>()
  for (const row of published) {
    if (row.brand_id === brand.id && row.brand_model_id) {
      publishedByModel.set(row.brand_model_id, row)
    }
  }

  const stats = toMarketStats(bundle.listings, bundle.sales)
  const models = modelRowsFromSubset(
    category,
    brand.slug,
    bundle.listings,
    bundle.sales,
    bundle,
    publishedByModel,
  )

  for (const catalog of catalogModels) {
    if (catalog.product_category_slug && catalog.product_category_slug !== category) continue
    const slug = priceGuideModelSlug(catalog.name)
    if (models.some((row) => row.model_slug === slug)) continue
    const modelEntry = publishedByModel.get(catalog.id) ?? null
    if (!modelEntry) continue
    models.push({
      model_id: catalog.id,
      model_name: catalog.name,
      model_slug: slug,
      href: priceGuideModelHref(category, brand.slug, slug),
      typical: resolveTypicalRange(
        { min_usd: null, max_usd: null, avg_usd: null, median_usd: null, p25_usd: null, p75_usd: null, count: 0 },
        { min_usd: null, max_usd: null, avg_usd: null, median_usd: null, p25_usd: null, p75_usd: null, count: 0 },
        modelEntry,
      ),
      asking: {
        min_usd: null,
        max_usd: null,
        avg_usd: null,
        median_usd: null,
        p25_usd: null,
        p75_usd: null,
        count: 0,
      },
      sold: {
        min_usd: null,
        max_usd: null,
        avg_usd: null,
        median_usd: null,
        p25_usd: null,
        p75_usd: null,
        count: 0,
      },
      confidence: resolveConfidence(0, 0, modelEntry),
    })
  }

  const publicEntry = entry?.status === "published" ? entry : null
  const manual = publicEntry
    ? (await listPriceGuideCompsForEntries(supabase, [publicEntry.id], true)).get(publicEntry.id) ?? []
    : []
  const live = await loadLiveListingsForScope(supabase, {
    section: category,
    brandId: brand.id,
  })

  return {
    category_slug: category,
    category_label: priceGuideCategoryLabel(category),
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo_url: brand.logo_url,
    },
    typical: resolveTypicalRange(stats.asking, stats.sold, publicEntry),
    asking: stats.asking,
    sold: stats.sold,
    confidence: resolveConfidence(stats.sold.count, stats.asking.count, publicEntry),
    entry: publicEntry,
    models,
    recent_sold: mergeComps(compsFromSales(bundle.sales, 16), manual, 12),
    live_listings: live,
  }
}

export async function getPriceGuideModelPage(
  supabase: SupabaseClient,
  category: PriceGuideCategorySlug,
  brandSlug: string,
  modelSlug: string,
): Promise<PriceGuideModelPage | null> {
  const brand = await getBrandBySlug(supabase, brandSlug)
  if (!brand) return null

  const catalogModels = await selectPriceGuideModelsForBrand(supabase, brand.id)
  const catalog = catalogModels.find((row) => priceGuideModelSlug(row.name) === modelSlug) ?? null

  const [bundle, entry] = await Promise.all([
    loadPriceGuideMarketBundle(supabase, { section: category, brandId: brand.id }),
    catalog
      ? getPriceGuideEntryByScope(supabase, {
          categorySlug: category,
          brandId: brand.id,
          brandModelId: catalog.id,
        })
      : Promise.resolve(null),
  ])

  const model = catalog
    ? { id: catalog.id, name: catalog.name, slug: priceGuideModelSlug(catalog.name) }
    : { id: null, name: modelSlug.replace(/-/g, " "), slug: modelSlug }

  const subset = filterBundle(bundle, (listing) =>
    listingMatchesModel(listing, bundle.snapshotsByListingId.get(listing.id), model),
  )

  if (subset.listings.length === 0 && !entry && !catalog) return null

  const displayName =
    catalog?.name ??
    resolveListingModelName(
      subset.listings[0] ?? {
        id: "",
        slug: null,
        title: null,
        section: category,
        status: "sold",
        price: null,
        condition: null,
        dimensions: null,
        brand: brand.name,
        model: model.name,
        brand_id: brand.id,
        brand_model_id: null,
        city: null,
        state: null,
        sold_off_platform: null,
        sold_off_platform_at: null,
        updated_at: null,
        hidden_from_site: false,
      },
      subset.listings[0] ? bundle.snapshotsByListingId.get(subset.listings[0].id) : undefined,
      bundle.modelsById,
    )?.name ??
    model.name

  const stats = toMarketStats(subset.listings, subset.sales)
  const publicEntry = entry?.status === "published" ? entry : null
  const manual = publicEntry
    ? (await listPriceGuideCompsForEntries(supabase, [publicEntry.id], true)).get(publicEntry.id) ?? []
    : []
  const live = await loadLiveListingsForScope(supabase, {
    section: category,
    brandId: brand.id,
    listingIds: subset.listings.map((row) => row.id),
  })

  const marketBands = conditionBandsFromSales(subset.sales)
  return {
    category_slug: category,
    category_label: priceGuideCategoryLabel(category),
    brand: {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logo_url: brand.logo_url,
    },
    model: { id: catalog?.id ?? null, name: displayName, slug: model.slug },
    typical: resolveTypicalRange(stats.asking, stats.sold, publicEntry),
    asking: stats.asking,
    sold: stats.sold,
    confidence: resolveConfidence(stats.sold.count, stats.asking.count, publicEntry),
    condition_bands: mergeConditionBands(marketBands, publicEntry?.condition_bands),
    entry: publicEntry,
    recent_sold: mergeComps(compsFromSales(subset.sales, 20), manual, 18),
    live_listings: live,
    browse_href: `${priceGuideBrowseHref(category)}?q=${encodeURIComponent(`${brand.name} ${displayName}`)}`,
    sell_href: priceGuideSellHref(category),
  }
}

export function priceGuideHomeHref(): string {
  return priceGuideHubHref()
}
