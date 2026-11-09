import { isReservedModelPageBrandSegment } from "@/lib/models/routes"
import { modelUsedRangeLabel } from "@/lib/models/model-page-hero"
import { moneyUsd } from "@/lib/price-guide/stats"

/**
 * A model URL is worth an index slot when a searcher would land on something
 * other than the name. Empty catalog shells were the bulk of "Crawled —
 * currently not indexed" after model pages launched.
 */
export type ModelIndexableSignals = {
  listingCount: number
  soldListingCount: number
  reviewCount: number
  hasProductDetail: boolean
  hasPriceGuide: boolean
}

export function isModelPageIndexable(signals: ModelIndexableSignals): boolean {
  return (
    signals.listingCount > 0 ||
    signals.soldListingCount > 0 ||
    signals.reviewCount > 0 ||
    signals.hasProductDetail ||
    signals.hasPriceGuide
  )
}

type IndexableVariant = {
  length_label?: string | null
  width_label?: string | null
  thickness_label?: string | null
  volume_label?: string | null
  material?: string | null
  fin_boxes?: string | null
}

/** Specs a shopper can use. The default fin-box value alone is not a detail. */
export function variantHasIndexableDetail(variant: IndexableVariant): boolean {
  const dimensions = [
    variant.length_label,
    variant.width_label,
    variant.thickness_label,
    variant.volume_label,
  ]
  if (dimensions.some((part) => Boolean(part?.trim()))) return true
  if (variant.material?.trim()) return true
  if (variant.fin_boxes?.trim()) return true
  return false
}

export function modelHasIndexableProductDetail(input: {
  description: string | null
  variants: readonly IndexableVariant[]
}): boolean {
  if (input.description?.trim()) return true
  return input.variants.some(variantHasIndexableDetail)
}

type IndexablePriceGuide = {
  typical: { low_usd: number | null; high_usd: number | null }
  condition_bands: readonly { sample_count: number }[]
  recent_sold: readonly unknown[]
  entry: { headline: string | null; summary: string | null; body: string | null } | null
}

export function hasIndexableModelPriceGuide(page: IndexablePriceGuide | null): boolean {
  if (!page) return false
  if (modelUsedRangeLabel(page.typical.low_usd, page.typical.high_usd)) return true
  if (page.recent_sold.length > 0) return true
  if (page.condition_bands.some((band) => band.sample_count > 0)) return true
  const entry = page.entry
  if (!entry) return false
  return Boolean(entry.headline?.trim() || entry.summary?.trim() || entry.body?.trim())
}

export type PriceGuideIndexableRow = {
  typical_low_usd: number | string | null
  typical_high_usd: number | string | null
  headline: string | null
  summary: string | null
  body: string | null
  condition_bands: unknown
}

function bandsHaveSamples(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false
  return raw.some((item) => {
    if (!item || typeof item !== "object") return false
    const count = (item as { sample_count?: unknown }).sample_count
    return typeof count === "number" && Number.isFinite(count) && count > 0
  })
}

/** Published price-guide row with a range, copy, or sampled condition band. */
export function priceGuideRowIsIndexable(row: PriceGuideIndexableRow): boolean {
  const low = moneyUsd(row.typical_low_usd)
  const high = moneyUsd(row.typical_high_usd)
  if (modelUsedRangeLabel(low, high)) return true
  if (row.headline?.trim() || row.summary?.trim() || row.body?.trim()) return true
  return bandsHaveSamples(row.condition_bands)
}

export type ModelSitemapCandidate = {
  id: string
  brandSlug: string
  modelSlug: string
  description: string | null
}

/** `"unknown"` keeps every model in the sitemap when a signal query fails. */
export type ModelSitemapSignal = ReadonlySet<string> | "unknown"

export type ModelSitemapIndexSignals = {
  listingModelIds: ModelSitemapSignal
  detailModelIds: ModelSitemapSignal
  priceGuideModelIds: ModelSitemapSignal
  reviewKeys: ModelSitemapSignal
}

function signalHas(signal: ModelSitemapSignal, value: string): boolean {
  if (signal === "unknown") return true
  return signal.has(value)
}

export function modelReviewKey(brandSlug: string, modelSlug: string): string {
  return `${brandSlug.trim().toLowerCase()}/${modelSlug.trim().toLowerCase()}`
}

export function modelSitemapCandidateIsIndexable(
  model: ModelSitemapCandidate,
  signals: ModelSitemapIndexSignals,
): boolean {
  if (model.description?.trim()) return true
  if (signalHas(signals.listingModelIds, model.id)) return true
  if (signalHas(signals.detailModelIds, model.id)) return true
  if (signalHas(signals.priceGuideModelIds, model.id)) return true
  return signalHas(signals.reviewKeys, modelReviewKey(model.brandSlug, model.modelSlug))
}

export function selectIndexableModelSitemapEntries(
  models: readonly ModelSitemapCandidate[],
  signals: ModelSitemapIndexSignals,
): Array<{ brandSlug: string; modelSlug: string }> {
  const seen = new Set<string>()
  const out: Array<{ brandSlug: string; modelSlug: string }> = []
  for (const model of models) {
    const brandSlug = model.brandSlug.trim().toLowerCase()
    const modelSlug = model.modelSlug.trim().toLowerCase()
    if (!brandSlug || !modelSlug || isReservedModelPageBrandSegment(brandSlug)) continue
    if (!modelSitemapCandidateIsIndexable({ ...model, brandSlug, modelSlug }, signals)) continue
    const key = modelReviewKey(brandSlug, modelSlug)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ brandSlug, modelSlug })
  }
  return out
}
