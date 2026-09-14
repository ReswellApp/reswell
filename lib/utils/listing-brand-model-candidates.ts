/**
 * Deterministic candidate extraction + junk filters for listing → catalog coverage.
 * Never invents a brand or model. Used before any LLM research call.
 */

const JUNK_BRAND_LABELS = new Set([
  "custom",
  "customs",
  "unknown",
  "n a",
  "na",
  "none",
  "other",
  "tbd",
  "tba",
  "brand",
  "no brand",
  "unbranded",
  "handmade",
  "surfboard",
  "surfboards",
  "board",
  "boards",
  "longboard",
  "shortboard",
  "used",
  "vintage",
  "local",
  "shaper",
  "misc",
  "miscellaneous",
])

const JUNK_MODEL_LABELS = new Set([
  "custom",
  "customs",
  "custom board",
  "one off",
  "oneoff",
  "ding repair",
  "repair",
  "deposit",
  "order deposit",
  "used",
  "unknown",
  "n a",
  "na",
  "none",
  "other",
  "model",
  "surfboard",
  "board",
  "longboard",
  "shortboard",
  "fish",
  "groveler",
  "step up",
  "gun",
  "midlength",
  "mid length",
  "hybrid",
])

const DIMENSION_RE =
  /^(?:\d{1,2}\s*['’]\s*\d{0,2}|\d{1,2}\s*(?:ft|foot|feet)|\d{1,2}\s*x\s*\d)/i

export function normalizeCatalogLabel(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function isDimensionOnlyLabel(raw: string, normalized: string): boolean {
  if (DIMENSION_RE.test(raw.trim()) || DIMENSION_RE.test(normalized)) return true
  return /^\d+(?:\s+\d+)*$/.test(normalized)
}

export function isJunkBrandLabel(raw: string | null | undefined): boolean {
  const label = normalizeCatalogLabel(raw)
  if (label.length < 3) return true
  if (JUNK_BRAND_LABELS.has(label)) return true
  if (isDimensionOnlyLabel(raw ?? "", label)) return true
  return false
}

export function isJunkModelLabel(raw: string | null | undefined): boolean {
  const label = normalizeCatalogLabel(raw)
  if (label.length < 3) return true
  if (JUNK_MODEL_LABELS.has(label)) return true
  if (isDimensionOnlyLabel(raw ?? "", label)) return true
  return false
}

export type ListingBrandModelCandidateSource = "seller_fields" | "title" | "none"

export type ListingBrandModelCandidates = {
  brandName: string | null
  modelName: string | null
  source: ListingBrandModelCandidateSource
}

/**
 * Pull brand/model candidates from seller-entered fields first, then a cleaned
 * title leftover only when it is not just category / dimension chatter.
 * Title leftovers are never treated as a confirmed brand on their own.
 */
export function extractListingBrandModelCandidates(input: {
  title?: string | null
  brand?: string | null
  model?: string | null
}): ListingBrandModelCandidates {
  const brandFromField = !isJunkBrandLabel(input.brand) ? input.brand?.trim() || null : null
  const modelFromField = !isJunkModelLabel(input.model) ? input.model?.trim() || null : null

  if (brandFromField || modelFromField) {
    return {
      brandName: brandFromField,
      modelName: modelFromField,
      source: "seller_fields",
    }
  }

  const title = (input.title ?? "").trim()
  if (!title) {
    return { brandName: null, modelName: null, source: "none" }
  }

  return { brandName: null, modelName: null, source: "title" }
}

export function labelsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeCatalogLabel(a)
  const right = normalizeCatalogLabel(b)
  return left.length > 0 && left === right
}
