export type PublicApiUrls = {
  html: string
  api: string
}

export type PublicApiListingCard = {
  id: string
  slug: string | null
  title: string
  brand: string | null
  model: string | null
  condition: string | null
  condition_label: string | null
  section: string
  board_type: string | null
  dimensions: string | null
  price_usd: number
  price_cents: number
  city: string | null
  state: string | null
  shipping_available: boolean
  local_pickup: boolean
  image_url: string | null
  urls: PublicApiUrls
}

export type PublicApiListingDetail = PublicApiListingCard & {
  status: string
  description: string | null
  image_urls: string[]
  seller: {
    name: string
    store_url: string | null
  }
  urls: PublicApiUrls & {
    seller: string | null
  }
}

export type PublicApiModelCard = {
  id: string
  name: string
  brand: string
  brand_slug: string
  urls: {
    brand_html: string
    search_html: string
    pricing_api: string
  }
}

export type PublicApiSoldComp = {
  sold_price_usd: number
  sold_at: string
  condition: string | null
  condition_label: string | null
  dimensions: string | null
  title: string | null
  listing_url: string | null
}

export type PublicApiMarketStats = {
  min_usd: number | null
  max_usd: number | null
  avg_usd: number | null
  median_usd: number | null
  count: number
}

export type PublicApiPricingResult = {
  brand: { id: string; name: string; slug: string }
  model: { name: string; slug: string } | null
  range: "365d"
  asking: PublicApiMarketStats
  sold: PublicApiMarketStats
  recent_sold: PublicApiSoldComp[]
  urls: {
    brand_html: string
    search_html: string
    sold_html: string
  }
}

export type PublicApiCatalog = {
  name: string
  docs: string
  llms_txt: string
  endpoints: Array<{
    method: "GET"
    path: string
    summary: string
  }>
}
