import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"

/** Matches `brand_product_categories.category_slug` for fin manufacturers. */
export const FIN_CATALOG_PRODUCT_CATEGORY: BrandProductCategorySlug = "fins"

/**
 * Fin-specific columns on `public.brand_model_variants` when
 * `product_category_slug = 'fins'`. Surfboard rows use length/width/thickness/volume labels instead.
 */
export const FIN_CATALOG_VARIANT_FIELD_NAMES = [
  "product_category_slug",
  "fin_size",
  "configuration_label",
  "fin_base_label",
  "fin_height_label",
  "fin_foil_label",
  "fin_color_label",
  "fin_box_type",
  "fin_boxes",
] as const

export type FinCatalogVariantFieldName = (typeof FIN_CATALOG_VARIANT_FIELD_NAMES)[number]

export function isFinCatalogVariantCategory(
  slug: string | null | undefined,
): slug is typeof FIN_CATALOG_PRODUCT_CATEGORY {
  return slug === FIN_CATALOG_PRODUCT_CATEGORY
}
