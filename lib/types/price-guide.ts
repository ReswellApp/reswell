import type { PriceGuideCategorySlug } from "@/lib/price-guide/categories"

export type PriceGuideStatus = "draft" | "published"
export type PriceGuidePricingSource = "market" | "editorial" | "mixed"
export type PriceGuideConfidence = "thin" | "emerging" | "solid" | "expert"
export type PriceGuideCompSource =
  | "reswell"
  | "fb_marketplace"
  | "craigslist"
  | "ebay"
  | "shop"
  | "other"

export type PriceGuideMarketStats = {
  min_usd: number | null
  max_usd: number | null
  avg_usd: number | null
  median_usd: number | null
  p25_usd: number | null
  p75_usd: number | null
  count: number
}

export type PriceGuideConditionBand = {
  condition: string
  condition_label: string
  low_usd: number | null
  mid_usd: number | null
  high_usd: number | null
  sample_count: number
}

export type PriceGuideComp = {
  id: string
  sold_price_usd: number
  sold_at: string
  condition: string | null
  condition_label: string | null
  dimensions: string | null
  title: string | null
  source: PriceGuideCompSource | "listed_as_sold" | "snapshot"
  source_label: string
  listing_url: string | null
  include_in_public: boolean
}

export type PriceGuideLiveListing = {
  id: string
  title: string
  price_usd: number
  condition_label: string | null
  dimensions: string | null
  city: string | null
  state: string | null
  image_url: string | null
  href: string
}

export type PriceGuideTypicalRange = {
  low_usd: number | null
  mid_usd: number | null
  high_usd: number | null
  new_retail_usd: number | null
  source: PriceGuidePricingSource
}

export type PriceGuideEntryRecord = {
  id: string
  category_slug: PriceGuideCategorySlug
  brand_id: string | null
  brand_model_id: string | null
  status: PriceGuideStatus
  featured: boolean
  sort_order: number
  pricing_source: PriceGuidePricingSource
  typical_low_usd: number | null
  typical_mid_usd: number | null
  typical_high_usd: number | null
  new_retail_usd: number | null
  condition_bands: PriceGuideConditionBand[]
  headline: string | null
  summary: string | null
  body: string | null
  confidence: PriceGuideConfidence | null
  notes_internal: string | null
  last_reviewed_at: string | null
  reviewed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PriceGuideScopeLabel = {
  category_slug: PriceGuideCategorySlug
  category_label: string
  brand: { id: string; name: string; slug: string; logo_url: string | null } | null
  model: { id: string; name: string; slug: string } | null
}

export type PriceGuideSearchHit = {
  kind: "category" | "brand" | "model"
  label: string
  sublabel: string
  href: string
  mid_usd: number | null
  sold_count: number
  asking_count: number
}

export type PriceGuideCategoryCard = {
  slug: PriceGuideCategorySlug
  label: string
  blurb: string
  href: string
  browse_href: string
  asking: PriceGuideMarketStats
  sold: PriceGuideMarketStats
  typical: PriceGuideTypicalRange
  brand_count: number
  listing_count: number
}

export type PriceGuideFeaturedModel = {
  href: string
  brand_name: string
  brand_slug: string
  model_name: string
  category_slug: PriceGuideCategorySlug
  typical: PriceGuideTypicalRange
  sold_count: number
  asking_count: number
  confidence: PriceGuideConfidence
  image_url: string | null
}

export type PriceGuideHub = {
  generated_at: string
  pulse: {
    active_listings: number
    sold_comps: number
    brands_covered: number
    models_covered: number
    median_surfboard_usd: number | null
  }
  categories: PriceGuideCategoryCard[]
  featured: PriceGuideFeaturedModel[]
  recent_sold: PriceGuideComp[]
  search_index: PriceGuideSearchHit[]
}

export type PriceGuideBrandRow = {
  brand_id: string
  brand_name: string
  brand_slug: string
  logo_url: string | null
  href: string
  typical: PriceGuideTypicalRange
  asking: PriceGuideMarketStats
  sold: PriceGuideMarketStats
  model_count: number
  confidence: PriceGuideConfidence
}

export type PriceGuideModelRow = {
  model_id: string | null
  model_name: string
  model_slug: string
  href: string
  typical: PriceGuideTypicalRange
  asking: PriceGuideMarketStats
  sold: PriceGuideMarketStats
  confidence: PriceGuideConfidence
}

export type PriceGuideCategoryPage = {
  category_slug: PriceGuideCategorySlug
  category_label: string
  blurb: string
  browse_href: string
  sell_href: string
  typical: PriceGuideTypicalRange
  asking: PriceGuideMarketStats
  sold: PriceGuideMarketStats
  confidence: PriceGuideConfidence
  entry: PriceGuideEntryRecord | null
  brands: PriceGuideBrandRow[]
  top_models: PriceGuideModelRow[]
  recent_sold: PriceGuideComp[]
}

export type PriceGuideBrandPage = {
  category_slug: PriceGuideCategorySlug
  category_label: string
  brand: { id: string; name: string; slug: string; logo_url: string | null }
  typical: PriceGuideTypicalRange
  asking: PriceGuideMarketStats
  sold: PriceGuideMarketStats
  confidence: PriceGuideConfidence
  entry: PriceGuideEntryRecord | null
  models: PriceGuideModelRow[]
  recent_sold: PriceGuideComp[]
  live_listings: PriceGuideLiveListing[]
}

export type PriceGuideModelPage = {
  category_slug: PriceGuideCategorySlug
  category_label: string
  brand: { id: string; name: string; slug: string; logo_url: string | null }
  model: { id: string | null; name: string; slug: string }
  typical: PriceGuideTypicalRange
  asking: PriceGuideMarketStats
  sold: PriceGuideMarketStats
  confidence: PriceGuideConfidence
  condition_bands: PriceGuideConditionBand[]
  entry: PriceGuideEntryRecord | null
  recent_sold: PriceGuideComp[]
  live_listings: PriceGuideLiveListing[]
  browse_href: string
  sell_href: string
}

export type PriceGuideAdminCoverageRow = {
  category_slug: PriceGuideCategorySlug
  brand_id: string
  brand_name: string
  brand_slug: string
  brand_model_id: string | null
  model_name: string | null
  model_slug: string | null
  sold_count: number
  asking_count: number
  mid_usd: number | null
  entry_id: string | null
  entry_status: PriceGuideStatus | null
}

export type PriceGuideAdminListItem = PriceGuideEntryRecord & {
  brand_name: string | null
  brand_slug: string | null
  model_name: string | null
  public_href: string
}

export type PriceGuideAdminDetail = {
  entry: PriceGuideEntryRecord
  scope: PriceGuideScopeLabel
  market: {
    asking: PriceGuideMarketStats
    sold: PriceGuideMarketStats
    typical: PriceGuideTypicalRange
    confidence: PriceGuideConfidence
    condition_bands: PriceGuideConditionBand[]
    recent_sold: PriceGuideComp[]
  }
  comps: PriceGuideComp[]
  public_href: string
}
