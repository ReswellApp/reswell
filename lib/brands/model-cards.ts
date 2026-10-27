import type { BrandModelRow } from "@/lib/db/brand-models"
import { modelPageSlug } from "@/lib/models/routes"

export type BrandPageModelCard = {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  product_category_slug: BrandModelRow["product_category_slug"]
}

export function toBrandPageModelCards(models: BrandModelRow[]): BrandPageModelCard[] {
  const out: BrandPageModelCard[] = []
  for (const model of models) {
    const slug = modelPageSlug(model.name)
    if (!slug) continue
    out.push({
      id: model.id,
      name: model.name,
      slug,
      description: model.description?.trim() || null,
      image_url: model.image_url?.trim() || null,
      product_category_slug: model.product_category_slug,
    })
  }
  return out
}
