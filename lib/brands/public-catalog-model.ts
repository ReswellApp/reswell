/**
 * Brand-page catalog models are named production shapes — not used-board
 * SKUs, custom deposits, or ding-repair listings that landed in `brand_models`
 * from shop inventory feeds.
 */
const USED_BOARD_SKU_RE = /\bused\b/i
const NON_PRODUCTION_MODEL_RE =
  /\b(ding\s*repair|order\s*deposit|custom\s+order|custom\s+deposit)\b/i

export function isPublicCatalogModelName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ""
  if (trimmed.length < 2) return false
  if (USED_BOARD_SKU_RE.test(trimmed)) return false
  if (NON_PRODUCTION_MODEL_RE.test(trimmed)) return false
  return true
}
