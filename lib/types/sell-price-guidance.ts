import type { PriceGuideCategorySlug } from "@/lib/price-guide/categories"
import type { PriceGuideConfidence, PriceGuidePricingSource } from "@/lib/types/price-guide"

/** How the suggested low/mid/high band was chosen for the sell form. */
export type SellPriceGuidanceMatch =
  | "condition"
  | "model"
  | "brand"
  | "unavailable"

export type SellPriceGuidanceTier = "low" | "mid" | "high"

export type SellPriceGuidanceRange = {
  low_usd: number
  mid_usd: number
  high_usd: number
}

export type SellPriceGuidance = {
  category_slug: PriceGuideCategorySlug
  brand_id: string
  brand_model_id: string
  brand_name: string
  brand_slug: string
  model_name: string
  model_slug: string
  condition: string | null
  condition_label: string | null
  match: SellPriceGuidanceMatch
  pricing_source: PriceGuidePricingSource
  confidence: PriceGuideConfidence
  sample_count: number
  range: SellPriceGuidanceRange
  /** Public price-guide model page when catalog brand/model resolve. */
  guide_href: string | null
  /** Short seller-facing explanation of the suggestion. */
  summary: string
}

export type SellPriceGuidanceResponse = {
  guidance: SellPriceGuidance | null
}
