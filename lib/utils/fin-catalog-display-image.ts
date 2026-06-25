/** True when a catalog image URL is a tiny color chip, not a product photo. */
export function isFinCatalogSwatchImageUrl(url: string | null | undefined): boolean {
  const t = url?.trim() ?? ""
  if (!t) return false
  if (/_50x/i.test(t)) return true
  return /\/board-models\/dimensions\/mirror-[a-f0-9]+\.png(?:[?#]|$)/i.test(t)
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
  return model ?? variant ?? logo
}
