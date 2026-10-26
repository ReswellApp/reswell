import {
  mobileBrandPageSchema,
  mobileBrandsPageSchema,
  mobileModelPageSchema,
  type MobileBrandPage,
  type MobileBrandsPage,
  type MobileListingCard,
  type MobileModelPage,
} from "@reswell/api-contract"
import { brandLogoDisplaySrc } from "@/lib/brand-media-proxy-url"
import {
  BRAND_PRODUCT_CATEGORY_SLUGS,
  brandProductCategoryLabel,
  type BrandProductCategorySlug,
} from "@/lib/brand-product-categories"
import { getBrandBySlug, listBrands } from "@/lib/brands/server"
import { countActiveListingsByBrandIds, listActiveListingsForBrand, listRecentlySoldListingsForBrand } from "@/lib/db/brand-listings"
import { listBrandModelsForPublicPageByBrandId } from "@/lib/db/brand-models"
import type { BrandModelVariantRow } from "@/lib/db/brand-model-variants"
import type { MobileListingRow } from "@/lib/db/mobile-listings"
import { formatGuideUsd, formatGuideUsdRange, PRICE_GUIDE_CONFIDENCE_LABEL } from "@/lib/price-guide/format"
import { toMobileListingCard, type MobileApiResult } from "@/lib/services/mobileApi"
import { getModelPage } from "@/lib/services/modelPage"
import { modelPageSlug } from "@/lib/models/routes"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"
import { getDb } from "@/lib/supabase/db"
import type { RecentListing } from "@/components/recent-feed-client"

const LISTING_LIMIT = 48

function publicLogo(raw: string | null | undefined): string | null {
  const src = brandLogoDisplaySrc(raw)
  if (!src) return null
  return absolutePublicMediaUrl(src) ?? (/^https?:\/\//i.test(src) ? src : null)
}

function publicImage(raw: string | null | undefined): string | null {
  const src = raw?.trim()
  if (!src) return null
  if (/^https?:\/\//i.test(src)) return src
  return absolutePublicMediaUrl(src) ?? null
}

function categoryLabel(slug: string | null | undefined): string {
  if (slug && (BRAND_PRODUCT_CATEGORY_SLUGS as readonly string[]).includes(slug)) {
    return brandProductCategoryLabel(slug as BrandProductCategorySlug)
  }
  return "Surfboards"
}

function catalogCards(rows: RecentListing[], brandName: string, modelName: string | null): MobileListingCard[] {
  const cards: MobileListingCard[] = []
  for (const row of rows) {
    const card = toMobileListingCard({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: null,
      status: row.status ?? "active",
      price: row.price,
      condition: row.condition ?? null,
      section: row.section,
      brand: brandName,
      model: modelName,
      board_type: row.board_type ?? null,
      dimensions: row.board_length ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      shipping_available: row.shipping_available ?? null,
      local_pickup: row.local_pickup ?? null,
      hidden_from_site: false,
      archived_at: null,
      shipping_price: null,
      board_shipping_cost_mode: null,
      listing_images: row.listing_images ?? null,
      profiles: row.profiles ?? null,
    } satisfies MobileListingRow)
    if (card) cards.push(card)
  }
  return cards
}

function variantLabel(row: BrandModelVariantRow): string {
  const dims = [row.length_label, row.width_label, row.thickness_label, row.volume_label]
    .map((part) => part.trim())
    .filter(Boolean)
  if (dims.length > 0) return dims.join(" × ")
  const fin = [row.configuration_label, row.fin_size, row.fin_boxes?.replace(/_/g, " ")]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
  return fin.join(" · ") || "Variant"
}

export async function listMobileBrandsService(): Promise<MobileApiResult<MobileBrandsPage>> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const brands = await listBrands(supabase)
  const counts = await countActiveListingsByBrandIds(
    supabase,
    brands.map((brand) => brand.id),
  )
  const parsed = mobileBrandsPageSchema.safeParse({
    brands: brands.map((brand) => ({
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logo_url: publicLogo(brand.logo_url),
      short_description: brand.short_description?.trim() || null,
      location_label: brand.location_label?.trim() || null,
      listing_count: counts.get(brand.id) ?? 0,
      model_count: brand.model_count,
    })),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load brands right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileBrandPageService(slug: string): Promise<MobileApiResult<MobileBrandPage>> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const brand = await getBrandBySlug(supabase, slug.trim().toLowerCase())
  if (!brand) return { ok: false, status: 404, error: "Brand not found" }

  const brandRef = { id: brand.id, name: brand.name }
  const [models, listings, sold] = await Promise.all([
    listBrandModelsForPublicPageByBrandId(supabase, brand.id),
    listActiveListingsForBrand(supabase, brandRef, { limit: LISTING_LIMIT }),
    listRecentlySoldListingsForBrand(supabase, brandRef, { limit: LISTING_LIMIT }),
  ])

  const parsed = mobileBrandPageSchema.safeParse({
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    logo_url: publicLogo(brand.logo_url),
    short_description: brand.short_description?.trim() || null,
    // Kept on the contract so older app builds still parse. Never send the official site.
    website_url: null,
    location_label: brand.location_label?.trim() || null,
    founder_name: brand.founder_name?.trim() || null,
    lead_shaper_name: brand.lead_shaper_name?.trim() || null,
    models: models.flatMap((model) => {
      const modelSlug = modelPageSlug(model.name)
      if (!modelSlug) return []
      return [
        {
          id: model.id,
          slug: modelSlug,
          name: model.name,
          image_url: publicImage(model.image_url),
          category_label: categoryLabel(model.product_category_slug),
        },
      ]
    }),
    listings: catalogCards(listings, brand.name, null),
    sold_listings: catalogCards(sold, brand.name, null),
    listings_capped: listings.length >= LISTING_LIMIT,
    sold_capped: sold.length >= LISTING_LIMIT,
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load this brand right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileModelPageService(
  brandSlug: string,
  modelSlug: string,
): Promise<MobileApiResult<MobileModelPage>> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const page = await getModelPage(supabase, brandSlug, modelSlug)
  if (!page) return { ok: false, status: 404, error: "Model not found" }

  const guide = page.priceGuide
  const parsed = mobileModelPageSchema.safeParse({
    brand_slug: page.brand.slug,
    brand_name: page.brand.name,
    model_slug: page.modelSlug,
    name: page.model.name,
    description: page.model.description?.trim() || null,
    category_label: categoryLabel(page.model.product_category_slug),
    hero_image_url: publicImage(page.listingImageUrl) ?? publicImage(page.model.image_url),
    variants: page.variants.slice(0, 24).map((variant) => ({
      id: variant.id,
      label: variantLabel(variant),
    })),
    listings: catalogCards(page.listings, page.brand.name, page.model.name),
    sold_listings: catalogCards(page.soldListings, page.brand.name, page.model.name),
    price_guide: guide
      ? {
          range_label: formatGuideUsdRange(guide.typical.low_usd, guide.typical.high_usd),
          sold_median_label: formatGuideUsd(guide.sold.median_usd),
          asking_median_label: formatGuideUsd(guide.asking.median_usd),
          sold_count: guide.sold.count,
          confidence_label: PRICE_GUIDE_CONFIDENCE_LABEL[guide.confidence],
          bands: guide.condition_bands.slice(0, 6).map((band) => ({
            condition_label: band.condition_label,
            typical_label: formatGuideUsd(band.mid_usd),
            comps: band.sample_count,
          })),
        }
      : null,
    review_average: page.reviewStats.avgRating,
    review_count: page.reviewStats.reviewCount,
    reviews: page.reviews.slice(0, 20).flatMap((review) => {
      const rating = Number(review.rating)
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return []
      const created = new Date(review.created_at)
      return [
        {
          id: review.id,
          rating,
          comment: review.comment?.trim() || null,
          author_name: review.profiles?.display_name?.trim() || "Buyer",
          created_label: Number.isNaN(created.getTime())
            ? ""
            : created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        },
      ]
    }),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load this model right now" }
  return { ok: true, data: parsed.data }
}
