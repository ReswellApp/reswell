import type { SupabaseClient } from "@supabase/supabase-js"
import { getBoardModelReviewStats, listBoardModelReviews } from "@/lib/board-model-reviews"
import { getBrandBySlug } from "@/lib/brands/server"
import {
  getPublicBrandModelById,
  listBrandModelsForPublicCatalogByBrandId,
  listBrandModelsForPublicPageByBrandId,
  type BrandModelRow,
} from "@/lib/db/brand-models"
import { matchCatalogModelForListingPage } from "@/lib/models/match"
import {
  listBrandModelVariantsForPublic,
  type BrandModelVariantRow,
} from "@/lib/db/brand-model-variants"
import { findSoldListingHeroImageForBrandModel } from "@/lib/db/brand-model-listing-images"
import {
  listActiveListingsForBrandModel,
  type ModelMarketplaceListing,
} from "@/lib/db/brand-listings"
import { listingHeroSlideSrc } from "@/lib/listing-image-display"
import { pickModelPageListingWithImage } from "@/lib/models/listing-image"
import { getCachedPriceGuideModel } from "@/lib/cache/price-guide"
import {
  findBrandModelBySlug,
  isReservedModelPageBrandSegment,
  modelPageHref,
  modelPageSlug,
} from "@/lib/models/routes"
import { pickTopModelListing } from "@/lib/models/top-pick"
import { isPriceGuideCategorySlug } from "@/lib/price-guide/categories"
import type { BrandRow } from "@/lib/brands/types"
import type { BoardModelReviewRow } from "@/lib/board-model-reviews"
import type { PriceGuideModelPage } from "@/lib/types/price-guide"

export type ModelPageData = {
  brand: BrandRow
  model: BrandModelRow
  modelSlug: string
  variants: BrandModelVariantRow[]
  listings: ModelMarketplaceListing[]
  topPick: ModelMarketplaceListing | null
  listingImageUrl: string | null
  priceGuide: PriceGuideModelPage | null
  reviews: BoardModelReviewRow[]
  reviewStats: { avgRating: number; reviewCount: number }
}

export async function getModelPage(
  supabase: SupabaseClient,
  brandSlug: string,
  modelSlugRaw: string,
): Promise<ModelPageData | null> {
  const brandSlugClean = brandSlug.trim().toLowerCase()
  const modelSlug = modelSlugRaw.trim().toLowerCase()
  if (!brandSlugClean || !modelSlug) return null
  if (isReservedModelPageBrandSegment(brandSlugClean)) return null

  const brand = await getBrandBySlug(supabase, brandSlugClean)
  if (!brand) return null

  const catalogModels = await listBrandModelsForPublicPageByBrandId(supabase, brand.id)
  const model = findBrandModelBySlug(catalogModels, modelSlug)
  if (!model) return null
  if (modelPageSlug(model.name) !== modelSlug) return null

  const category = isPriceGuideCategorySlug(model.product_category_slug)
    ? model.product_category_slug
    : "surfboards"

  const [variants, listings, priceGuide, reviewStats, reviews] = await Promise.all([
    listBrandModelVariantsForPublic(supabase, model.id),
    listActiveListingsForBrandModel(supabase, {
      brand: { id: brand.id, name: brand.name },
      model: { id: model.id, name: model.name },
      limit: 48,
    }),
    getCachedPriceGuideModel(category, brand.slug, modelSlug),
    getBoardModelReviewStats(supabase, brand.slug, modelSlug),
    listBoardModelReviews(supabase, brand.slug, modelSlug),
  ])

  const topPick = pickTopModelListing(listings)
  const photoListing = pickModelPageListingWithImage(listings, topPick)
  const listingImageUrl =
    listingHeroSlideSrc(photoListing?.listing_images) ??
    (await findSoldListingHeroImageForBrandModel(supabase, model.id))

  return {
    brand,
    model,
    modelSlug,
    variants,
    listings,
    topPick,
    listingImageUrl,
    priceGuide,
    reviews,
    reviewStats,
  }
}

export async function resolveListingModelPageHref(
  supabase: SupabaseClient,
  input: {
    brand: { id: string; slug: string } | null | undefined
    brandModelId?: string | null
    modelName?: string | null
  },
): Promise<string | null> {
  const brandId = input.brand?.id.trim() ?? ""
  const brandSlug = input.brand?.slug.trim() ?? ""
  if (!brandId || !brandSlug || isReservedModelPageBrandSegment(brandSlug)) return null

  const brandModelId = input.brandModelId?.trim() ?? ""
  const modelName = input.modelName?.trim() ?? ""

  if (brandModelId) {
    const linked = await getPublicBrandModelById(supabase, brandModelId)
    if (linked && linked.brand_id === brandId) {
      return modelPageHref(brandSlug, modelPageSlug(linked.name))
    }
  }

  if (!modelName) return null

  const catalog = await listBrandModelsForPublicCatalogByBrandId(supabase, brandId)
  const match = matchCatalogModelForListingPage(catalog, modelName)
  if (!match) return null
  return modelPageHref(brandSlug, modelPageSlug(match.name))
}
