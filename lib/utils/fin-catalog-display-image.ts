const FIN_CATALOG_DIMENSIONS_MIRROR_PATH =
  /(?:^|\/)board-models\/dimensions\/mirror-[a-f0-9]+\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i

/** True when a catalog image URL is a tiny color chip, not a product photo. */
export function isFinCatalogSwatchImageUrl(url: string | null | undefined): boolean {
  const t = url?.trim() ?? ""
  if (!t) return false
  if (/_50x/i.test(t)) return true
  return FIN_CATALOG_DIMENSIONS_MIRROR_PATH.test(t)
}

/** Pick the best thumbnail for fin catalog search / sell-flow rows. */
export function finCatalogThumbImageUrl(opts: {
  variantImageUrl?: string | null
  modelImageUrl?: string | null
  brandLogoUrl?: string | null
}): string | null {
  const variant = opts.variantImageUrl?.trim() || null
  const model = opts.modelImageUrl?.trim() || null
  const logo = opts.brandLogoUrl?.trim() || null

  if (variant && !isFinCatalogSwatchImageUrl(variant)) return variant
  if (model && !isFinCatalogSwatchImageUrl(model)) return model
  return logo ?? variant ?? model ?? null
}

type FinCatalogSearchRowThumbInput =
  | { kind: "brand"; logoUrl: string | null }
  | { kind: "model"; imageUrl: string | null; brandLogoUrl: string | null }
  | {
      kind: "variant"
      imageUrl: string | null
      modelImageUrl: string | null
      brandLogoUrl: string | null
    }

/** Resolved catalog thumbnail for `/sell/fins` search rows (brands, models, variants). */
export function finCatalogSearchRowThumbUrl(row: FinCatalogSearchRowThumbInput): string | null {
  if (row.kind === "brand") return row.logoUrl?.trim() || null
  if (row.kind === "model") {
    return finCatalogThumbImageUrl({
      modelImageUrl: row.imageUrl,
      brandLogoUrl: row.brandLogoUrl,
    })
  }
  return finCatalogThumbImageUrl({
    variantImageUrl: row.imageUrl,
    modelImageUrl: row.modelImageUrl,
    brandLogoUrl: row.brandLogoUrl,
  })
}
