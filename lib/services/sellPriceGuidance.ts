import type { SupabaseClient } from "@supabase/supabase-js"
import { getPriceGuideEntryByScope } from "@/lib/db/price-guide-entries"
import {
  selectPriceGuideBrandsByIds,
  selectPriceGuideModelsByIds,
} from "@/lib/db/price-guide-market"
import { formatCondition, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import {
  priceGuideModelHref,
  priceGuideModelSlug,
  type PriceGuideCategorySlug,
} from "@/lib/price-guide/categories"
import {
  conditionBandsFromSales,
  loadPriceGuideMarketBundle,
  mergeConditionBands,
  resolveConfidence,
  resolveTypicalRange,
  toMarketStats,
} from "@/lib/services/priceGuideMarket"
import type {
  PriceGuideConditionBand,
  PriceGuideEntryRecord,
  PriceGuidePricingSource,
  PriceGuideTypicalRange,
} from "@/lib/types/price-guide"
import type {
  SellPriceGuidance,
  SellPriceGuidanceMatch,
  SellPriceGuidanceRange,
} from "@/lib/types/sell-price-guidance"
import type { SellPriceGuidanceQuery } from "@/lib/validations/sell-price-guidance"

function roundGuidanceUsd(value: number): number {
  return Math.max(1, Math.round(value))
}

function bandToRange(band: {
  low_usd: number | null
  mid_usd: number | null
  high_usd: number | null
}): SellPriceGuidanceRange | null {
  const mid = band.mid_usd
  if (mid == null || !Number.isFinite(mid) || mid <= 0) return null
  const low = band.low_usd != null && band.low_usd > 0 ? band.low_usd : mid
  const high = band.high_usd != null && band.high_usd > 0 ? band.high_usd : mid
  const roundedLow = roundGuidanceUsd(Math.min(low, mid, high))
  const roundedMid = roundGuidanceUsd(mid)
  const roundedHigh = roundGuidanceUsd(Math.max(low, mid, high))
  return {
    low_usd: Math.min(roundedLow, roundedMid),
    mid_usd: roundedMid,
    high_usd: Math.max(roundedHigh, roundedMid),
  }
}

function typicalToRange(typical: PriceGuideTypicalRange): SellPriceGuidanceRange | null {
  return bandToRange({
    low_usd: typical.low_usd,
    mid_usd: typical.mid_usd,
    high_usd: typical.high_usd,
  })
}

function findConditionBand(
  bands: PriceGuideConditionBand[],
  condition: string,
): PriceGuideConditionBand | null {
  return bands.find((band) => band.condition === condition) ?? null
}

function buildSummary(input: {
  match: SellPriceGuidanceMatch
  conditionLabel: string | null
  brandName: string
  modelName: string
  sampleCount: number
  pricingSource: PriceGuidePricingSource
}): string {
  const modelLabel = `${input.brandName} ${input.modelName}`.trim()
  if (input.match === "condition" && input.conditionLabel) {
    if (input.sampleCount > 0) {
      return `Suggested for ${input.conditionLabel.toLowerCase()} ${modelLabel} from ${input.sampleCount} recent sale${input.sampleCount === 1 ? "" : "s"}.`
    }
    return `Suggested for ${input.conditionLabel.toLowerCase()} ${modelLabel}.`
  }
  if (input.match === "model") {
    if (input.pricingSource === "editorial") {
      return `Typical Reswell range for ${modelLabel}. Choose a condition for a tighter suggestion.`
    }
    if (input.sampleCount > 0) {
      return `Based on ${input.sampleCount} ${modelLabel} sale${input.sampleCount === 1 ? "" : "s"}. Choose a condition for a tighter suggestion.`
    }
    return `Typical range for ${modelLabel}.`
  }
  if (input.match === "brand") {
    return `Brand-level guidance for ${input.brandName}. Add a catalog model when you can.`
  }
  return "Not enough pricing data for this item yet."
}

/**
 * Pure resolver used by the sell flow and unit tests.
 * Prefers condition bands (editorial overlay merged with market), then model typical.
 * Does not write back into sold comps — editorial stays on `price_guide_entries`.
 */
export function resolveSellPriceGuidanceRange(input: {
  condition: string | null
  conditionBands: PriceGuideConditionBand[]
  typical: PriceGuideTypicalRange
  soldSampleCount: number
}): {
  range: SellPriceGuidanceRange | null
  match: SellPriceGuidanceMatch
  sample_count: number
  condition_label: string | null
} {
  const condition = input.condition?.trim() || null
  if (condition) {
    const band = findConditionBand(input.conditionBands, condition)
    const range = band ? bandToRange(band) : null
    if (range) {
      return {
        range,
        match: "condition",
        sample_count: band?.sample_count ?? 0,
        condition_label:
          band?.condition_label ||
          LISTING_CONDITION_LABELS[condition] ||
          formatCondition(condition),
      }
    }
  }

  const modelRange = typicalToRange(input.typical)
  if (modelRange) {
    return {
      range: modelRange,
      match: "model",
      sample_count: input.soldSampleCount,
      condition_label: condition
        ? LISTING_CONDITION_LABELS[condition] || formatCondition(condition)
        : null,
    }
  }

  return {
    range: null,
    match: "unavailable",
    sample_count: 0,
    condition_label: condition
      ? LISTING_CONDITION_LABELS[condition] || formatCondition(condition)
      : null,
  }
}

async function loadPublishedEntryWithFallback(
  supabase: SupabaseClient,
  category: PriceGuideCategorySlug,
  brandId: string,
  brandModelId: string,
): Promise<PriceGuideEntryRecord | null> {
  const modelEntry = await getPriceGuideEntryByScope(supabase, {
    categorySlug: category,
    brandId,
    brandModelId,
  })
  if (modelEntry?.status === "published") return modelEntry

  const brandEntry = await getPriceGuideEntryByScope(supabase, {
    categorySlug: category,
    brandId,
    brandModelId: null,
  })
  return brandEntry?.status === "published" ? brandEntry : null
}

/**
 * Sell-flow pricing suggestion for a catalog brand + model.
 * Reads published `price_guide_entries` (editorial) and market sold/ask stats separately —
 * never mutates sold comps.
 */
export async function getSellPriceGuidance(
  supabase: SupabaseClient,
  query: SellPriceGuidanceQuery,
): Promise<SellPriceGuidance | null> {
  const category = query.category_slug as PriceGuideCategorySlug
  const brandId = query.brand_id
  const brandModelId = query.brand_model_id
  const condition = query.condition

  const [brands, models, entry] = await Promise.all([
    selectPriceGuideBrandsByIds(supabase, [brandId]),
    selectPriceGuideModelsByIds(supabase, [brandModelId]),
    loadPublishedEntryWithFallback(supabase, category, brandId, brandModelId),
  ])

  const brand = brands[0] ?? null
  const model = models[0] ?? null
  if (!brand || !model || model.brand_id !== brand.id) return null

  const bundle = await loadPriceGuideMarketBundle(supabase, {
    section: category,
    brandId: brand.id,
    brandModelId,
  })

  const modelListings = bundle.listings
  const modelSales = bundle.sales
  const stats = toMarketStats(modelListings, modelSales)
  const modelEntry = entry?.brand_model_id === brandModelId ? entry : null
  const brandEntry = entry?.brand_model_id == null ? entry : null
  // Only model-scoped editorial overlays merge into model typicals. Brand-level
  // entries are a last-resort fallback when the model has no market range yet.
  const typical = resolveTypicalRange(stats.asking, stats.sold, modelEntry)
  const marketBands = conditionBandsFromSales(modelSales)
  const conditionBands = mergeConditionBands(marketBands, modelEntry?.condition_bands)

  const resolved = resolveSellPriceGuidanceRange({
    condition,
    conditionBands,
    typical,
    soldSampleCount: stats.sold.count,
  })

  if (!resolved.range) {
    // Brand-level editorial fallback when the model has no market or entry range yet.
    if (brandEntry && brandEntry.pricing_source !== "market") {
      const brandRange = typicalToRange({
        low_usd: brandEntry.typical_low_usd,
        mid_usd: brandEntry.typical_mid_usd,
        high_usd: brandEntry.typical_high_usd,
        new_retail_usd: brandEntry.new_retail_usd,
        source: brandEntry.pricing_source,
      })
      if (brandRange) {
        const match: SellPriceGuidanceMatch = "brand"
        const pricingSource = brandEntry.pricing_source
        const confidence = resolveConfidence(0, 0, brandEntry)
        return {
          category_slug: category,
          brand_id: brand.id,
          brand_model_id: model.id,
          brand_name: brand.name,
          brand_slug: brand.slug,
          model_name: model.name,
          model_slug: priceGuideModelSlug(model.name),
          condition,
          condition_label: resolved.condition_label,
          match,
          pricing_source: pricingSource,
          confidence,
          sample_count: 0,
          range: brandRange,
          guide_href: priceGuideModelHref(category, brand.slug, priceGuideModelSlug(model.name)),
          summary: buildSummary({
            match,
            conditionLabel: resolved.condition_label,
            brandName: brand.name,
            modelName: model.name,
            sampleCount: 0,
            pricingSource,
          }),
        }
      }
    }
    return null
  }

  const pricingSource = typical.source
  const confidence = resolveConfidence(stats.sold.count, stats.asking.count, modelEntry)
  const match = resolved.match
  const modelSlug = priceGuideModelSlug(model.name)

  return {
    category_slug: category,
    brand_id: brand.id,
    brand_model_id: model.id,
    brand_name: brand.name,
    brand_slug: brand.slug,
    model_name: model.name,
    model_slug: modelSlug,
    condition,
    condition_label: resolved.condition_label,
    match,
    pricing_source: pricingSource,
    confidence,
    sample_count: resolved.sample_count,
    range: resolved.range,
    guide_href: priceGuideModelHref(category, brand.slug, modelSlug),
    summary: buildSummary({
      match,
      conditionLabel: resolved.condition_label,
      brandName: brand.name,
      modelName: model.name,
      sampleCount: resolved.sample_count,
      pricingSource,
    }),
  }
}

export { sellPriceGuidanceToInputValue } from "@/lib/sell-price-guidance-format"
