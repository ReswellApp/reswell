import type { BrandModelRow } from "@/lib/db/brand-models"
import type { BrandModelMarketplaceCover } from "@/lib/db/brand-listings"
import { isPublicCatalogModelName } from "@/lib/brands/public-catalog-model"
import { modelPageSlug } from "@/lib/models/routes"

export type BrandPageModelCard = {
  id: string
  name: string
  slug: string
  product_category_slug: BrandModelRow["product_category_slug"]
  /** Marketplace listing thumb only. Null when no Reswell listing photo exists. */
  listing_image_url: string | null
  active_listing_count: number
  sold_listing_count: number
}

function marketplaceActivity(card: Pick<BrandPageModelCard, "active_listing_count" | "sold_listing_count">): number {
  return card.active_listing_count + card.sold_listing_count
}

export function toBrandPageModelCards(
  models: BrandModelRow[],
  listingCoversByModelId: ReadonlyMap<string, BrandModelMarketplaceCover> = new Map(),
): BrandPageModelCard[] {
  const out: BrandPageModelCard[] = []
  for (const model of models) {
    if (!isPublicCatalogModelName(model.name)) continue
    const slug = modelPageSlug(model.name)
    if (!slug) continue
    const cover = listingCoversByModelId.get(model.id)
    out.push({
      id: model.id,
      name: model.name,
      slug,
      product_category_slug: model.product_category_slug,
      listing_image_url: cover?.imageUrl?.trim() || null,
      active_listing_count: cover?.activeCount ?? 0,
      sold_listing_count: cover?.soldCount ?? 0,
    })
  }

  // Popular models first (same discovery energy as Pango title lists).
  out.sort((a, b) => {
    const byActivity = marketplaceActivity(b) - marketplaceActivity(a)
    if (byActivity !== 0) return byActivity
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })

  return out
}
