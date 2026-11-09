import { BRANDS_BASE } from "@/lib/brands/routes"
import { brandProductCategoryLabel, type BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { listingDetailHref } from "@/lib/listing-href"
import { listingHeroSlideSrc, listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { formatBoardType, formatCondition } from "@/lib/listing-labels"
import { modelPageHeroImage, pickModelPageListingWithImage } from "@/lib/models/listing-image"
import { modelPageHref } from "@/lib/models/routes"
import { isPriceGuideCategorySlug, priceGuideBrowseHref, priceGuideHubHref, priceGuideSellHref } from "@/lib/price-guide/categories"
import type { PriceGuideComp, PriceGuideMarketStats, PriceGuideModelPage } from "@/lib/types/price-guide"

const SALE_ROW_LIMIT = 12
const LOS_ANGELES = "America/Los_Angeles"

const BUY_LABEL: Record<BrandProductCategorySlug, string> = {
  surfboards: "Buy the board",
  fins: "Buy the fins",
  wetsuits: "Buy the wetsuit",
  boardbags: "Buy the bag",
  surfpacks: "Buy the pack",
  leashes: "Buy the leash",
  apparel: "Buy now",
  accessories: "Buy now",
}

export type ModelPricingListing = {
  id: string
  slug?: string | null
  price: number
  section?: string
  condition?: string | null
  updated_at?: string | null
  listing_images?: unknown
}

export type ModelPricingInput = {
  brand: {
    name: string
    slug: string
    logo_url: string | null
    location_label: string | null
  }
  model: {
    name: string
    image_url: string | null
    product_category_slug: BrandProductCategorySlug
    board_category_slug: string | null
  }
  modelSlug: string
  variants: readonly {
    length_label: string
    width_label: string
    thickness_label: string
  }[]
  listings: readonly ModelPricingListing[]
  soldListings: readonly ModelPricingListing[]
  topPick: ModelPricingListing | null
  listingImageUrl: string | null
  priceGuide: PriceGuideModelPage | null
}

export type ModelPricingCrumb = {
  label: string
  href?: string
}

export type ModelPricingSale = {
  id: string
  href: string | null
  imageUrl: string | null
  imageAlt: string
  priceLabel: string
  conditionLabel: string
  dateLabel: string
}

export type ModelPricingViewModel = {
  title: string
  brandName: string
  brandHref: string
  specLine: string | null
  categoryLabel: string
  categoryHref: string
  locationLabel: string | null
  imageUrl: string | null
  imageAlt: string
  brandLogoUrl: string | null
  salesCountLabel: string
  salesNoun: string
  liveListingsLabel: string
  rangeLabel: string
  avgLabel: string
  medianLabel: string
  buy: { href: string; label: string } | null
  listingsHref: string
  sellHref: string
  allModelsHref: string
  crumbs: ModelPricingCrumb[]
  sales: ModelPricingSale[]
}

export function modelPricingHref(brandSlug: string, modelSlug: string): string {
  return `/pricing/brand/${brandSlug.trim()}/${modelSlug.trim()}`
}

/** Screenshot-style count: 1000 and above compress to "1000+". */
export function formatPricingCount(count: number): string {
  const n = Math.max(0, Math.floor(count))
  if (n >= 1000) return "1000+"
  return n.toLocaleString("en-US")
}

export function formatPricingUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPricingRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return "—"
  if (low != null && high != null && low !== high) {
    return `${formatPricingUsd(low)} – ${formatPricingUsd(high)}`
  }
  return formatPricingUsd(low ?? high)
}

export function formatPricingSaleDate(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return "—"
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (dateOnly) {
    const date = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    return formatCalendarDate(date, "UTC")
  }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return "—"
  return formatCalendarDate(date, LOS_ANGELES)
}

export function isModelPricingPageIndexable(input: {
  listingCount: number
  soldListingCount: number
  guideSoldCount: number
  guideAskingCount: number
  hasPriceGuide: boolean
}): boolean {
  return (
    input.listingCount > 0 ||
    input.soldListingCount > 0 ||
    input.guideSoldCount > 0 ||
    input.guideAskingCount > 0 ||
    input.hasPriceGuide
  )
}

export function buildModelPricingView(page: ModelPricingInput): ModelPricingViewModel {
  const category = page.model.product_category_slug
  const categoryHref = isPriceGuideCategorySlug(category) ? priceGuideBrowseHref(category) : "/boards"
  const sellHref = isPriceGuideCategorySlug(category) ? priceGuideSellHref(category) : "/sell"
  const listingsHref = `${modelPageHref(page.brand.slug, page.modelSlug)}#listings`
  const brandHref = `${BRANDS_BASE}/${page.brand.slug}`
  const imageUrl = pricingImageUrl(page)
  const numbers = marketNumbers(page)
  const cheapest = cheapestListing(page.listings)
  const sales = saleRows(page, imageUrl)

  return {
    title: page.model.name,
    brandName: page.brand.name,
    brandHref,
    specLine: identitySpec(page.variants),
    categoryLabel: categoryLine(category, page.model.board_category_slug),
    categoryHref,
    locationLabel: page.brand.location_label?.trim() || null,
    imageUrl,
    imageAlt: `${page.brand.name} ${page.model.name}`,
    brandLogoUrl: page.brand.logo_url,
    salesCountLabel: formatPricingCount(numbers.salesCount),
    salesNoun: numbers.salesCount === 1 ? "sale" : "sales",
    liveListingsLabel: liveListingsLabel(numbers.liveCount),
    rangeLabel: formatPricingRange(numbers.low, numbers.high),
    avgLabel: formatPricingUsd(numbers.avg),
    medianLabel: formatPricingUsd(numbers.median),
    buy: cheapest
      ? { href: listingDetailHref(cheapest), label: BUY_LABEL[category] }
      : null,
    listingsHref,
    sellHref,
    allModelsHref: brandHref,
    crumbs: [
      { label: "Home", href: "/" },
      { label: "Pricing", href: priceGuideHubHref() },
      { label: page.brand.name, href: brandHref },
      { label: page.model.name },
    ],
    sales,
  }
}

function formatCalendarDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date)
}

function liveListingsLabel(count: number): string {
  const noun = count === 1 ? "live listing" : "live listings"
  return `${formatPricingCount(count)} ${noun}`
}

function categoryLine(category: BrandProductCategorySlug, boardType: string | null): string {
  const label = brandProductCategoryLabel(category)
  const shape = formatBoardType(boardType)
  if (!shape || shape.toLowerCase() === label.toLowerCase()) return label
  return `${label} / ${shape}`
}

function identitySpec(
  variants: ModelPricingInput["variants"],
): string | null {
  const detailed = variants.filter((variant) =>
    [variant.length_label, variant.width_label, variant.thickness_label].some((part) => part.trim()),
  )
  if (detailed.length !== 1) return null
  const variant = detailed[0]!
  const parts = [variant.length_label, variant.width_label, variant.thickness_label]
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join(" × ") : null
}

function pricingImageUrl(page: ModelPricingInput): string | null {
  const livePhoto = pickModelPageListingWithImage(page.listings, page.topPick)
  const soldPhoto = pickModelPageListingWithImage(page.soldListings)
  const hero = modelPageHeroImage({
    livePhotoUrl: livePhoto ? listingHeroSlideSrc(livePhoto.listing_images) : null,
    soldPhotoUrl: soldPhoto ? listingHeroSlideSrc(soldPhoto.listing_images) : null,
    fallbackSoldUrl: page.listingImageUrl,
  })
  return hero.url ?? page.model.image_url?.trim() ?? null
}

function marketNumbers(page: ModelPricingInput): {
  salesCount: number
  liveCount: number
  low: number | null
  high: number | null
  avg: number | null
  median: number | null
} {
  const sold = page.priceGuide?.sold
  const asking = page.priceGuide?.asking
  const typical = page.priceGuide?.typical
  const salesCount = Math.max(sold?.count ?? 0, page.soldListings.length)
  const liveCount = Math.max(asking?.count ?? 0, page.listings.length)
  const soldHasPrices = (sold?.count ?? 0) > 0
  const askingHasPrices = (asking?.count ?? 0) > 0

  return {
    salesCount,
    liveCount,
    low: firstStat(soldHasPrices ? sold?.min_usd : null, askingHasPrices ? asking?.min_usd : null, typical?.low_usd),
    high: firstStat(soldHasPrices ? sold?.max_usd : null, askingHasPrices ? asking?.max_usd : null, typical?.high_usd),
    avg: firstStat(soldHasPrices ? sold?.avg_usd : null, askingHasPrices ? asking?.avg_usd : null, typical?.mid_usd),
    median: firstStat(
      soldHasPrices ? sold?.median_usd : null,
      askingHasPrices ? asking?.median_usd : null,
      typical?.mid_usd,
    ),
  }
}

function firstStat(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return value
  }
  return null
}

function cheapestListing(listings: readonly ModelPricingListing[]): ModelPricingListing | null {
  let best: ModelPricingListing | null = null
  let bestPrice = Number.POSITIVE_INFINITY
  for (const listing of listings) {
    const price = Number(listing.price)
    if (!Number.isFinite(price) || price <= 0) continue
    if (price < bestPrice) {
      best = listing
      bestPrice = price
    }
  }
  return best
}

function saleRows(page: ModelPricingInput, fallbackImage: string | null): ModelPricingSale[] {
  const fromListings = page.soldListings.slice(0, SALE_ROW_LIMIT).map((listing) => {
    const thumb = listingTitleThumbnailSrc(
      listing.listing_images as Parameters<typeof listingTitleThumbnailSrc>[0],
    )
    return {
      id: listing.id,
      href: listingDetailHref(listing),
      imageUrl: thumb || fallbackImage,
      imageAlt: `${page.brand.name} ${page.model.name}`,
      priceLabel: formatPricingUsd(Number(listing.price)),
      conditionLabel: formatCondition(listing.condition) || "—",
      dateLabel: formatPricingSaleDate(listing.updated_at),
    }
  })
  if (fromListings.length > 0) return fromListings
  return (page.priceGuide?.recent_sold ?? []).slice(0, SALE_ROW_LIMIT).map((comp) =>
    saleFromComp(comp, page, fallbackImage),
  )
}

function saleFromComp(
  comp: PriceGuideComp,
  page: ModelPricingInput,
  fallbackImage: string | null,
): ModelPricingSale {
  return {
    id: comp.id,
    href: compHref(comp.listing_url),
    imageUrl: fallbackImage,
    imageAlt: `${page.brand.name} ${page.model.name}`,
    priceLabel: formatPricingUsd(comp.sold_price_usd),
    conditionLabel: comp.condition_label?.trim() || "—",
    dateLabel: formatPricingSaleDate(comp.sold_at),
  }
}

function compHref(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith("/")) return url
  try {
    const parsed = new URL(url)
    if (parsed.hostname === "reswell.app" || parsed.hostname === "www.reswell.app") {
      return `${parsed.pathname}${parsed.search}`
    }
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString()
  } catch {
    return null
  }
  return null
}

export function emptyMarketStats(): PriceGuideMarketStats {
  return {
    min_usd: null,
    max_usd: null,
    avg_usd: null,
    median_usd: null,
    p25_usd: null,
    p75_usd: null,
    count: 0,
  }
}
