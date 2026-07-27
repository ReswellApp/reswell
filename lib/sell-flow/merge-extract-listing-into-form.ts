import type { ExtractListingFromPhotosNormalized } from "@/lib/validations/extract-listing-from-photos"
import { EXTRACT_LISTING_MAX_IMAGE_URLS } from "@/lib/validations/extract-listing-from-photos"

export const EXTRACT_LISTING_DIM_FACET_KEYS = [
  "boardLength",
  "boardWidthInches",
  "boardThicknessInches",
  "boardVolumeL",
  "boardFins",
  "boardFinSystem",
  "boardConstruction",
] as const

/** Directory brand fields filled together from matchedBrand. */
export const EXTRACT_LISTING_BRAND_KEYS = [
  "brand",
  "boardBrandId",
  "boardLinkedBrandName",
  "boardIndexBrandSlug",
] as const

export const EXTRACT_LISTING_AI_FIELD_KEYS = [
  ...EXTRACT_LISTING_DIM_FACET_KEYS,
  ...EXTRACT_LISTING_BRAND_KEYS,
] as const

export type ExtractListingAiFieldKey = (typeof EXTRACT_LISTING_AI_FIELD_KEYS)[number]

export type ExtractListingFormSlice = Record<ExtractListingAiFieldKey, string>

function isEmpty(value: string | undefined): boolean {
  return !value?.trim()
}

/**
 * Merge AI extract into empty form slots only. Returns patch + which keys were filled.
 */
export function mergeExtractListingIntoEmptyFields(
  current: ExtractListingFormSlice,
  extracted: ExtractListingFromPhotosNormalized,
): {
  patch: Partial<ExtractListingFormSlice>
  filledKeys: ExtractListingAiFieldKey[]
} {
  const patch: Partial<ExtractListingFormSlice> = {}
  const filledKeys: ExtractListingAiFieldKey[] = []

  const candidates: {
    key: (typeof EXTRACT_LISTING_DIM_FACET_KEYS)[number]
    next: string | null
  }[] = [
    { key: "boardLength", next: extracted.boardLength },
    { key: "boardWidthInches", next: extracted.boardWidthInches },
    { key: "boardThicknessInches", next: extracted.boardThicknessInches },
    { key: "boardVolumeL", next: extracted.boardVolumeL },
    { key: "boardFins", next: extracted.boardFins },
    { key: "boardFinSystem", next: extracted.boardFinSystem },
    { key: "boardConstruction", next: extracted.boardConstruction },
  ]

  for (const { key, next } of candidates) {
    if (!next?.trim()) continue
    if (!isEmpty(current[key])) continue
    patch[key] = next.trim()
    filledKeys.push(key)
  }

  const matched = extracted.matchedBrand
  const brandSlotEmpty = isEmpty(current.brand) && isEmpty(current.boardBrandId)
  if (matched && brandSlotEmpty) {
    patch.brand = matched.name
    patch.boardBrandId = matched.id
    patch.boardLinkedBrandName = matched.name
    patch.boardIndexBrandSlug = matched.slug
    filledKeys.push(...EXTRACT_LISTING_BRAND_KEYS)
  }

  return { patch, filledKeys }
}

/**
 * Pick up to N listing thumbs spread across the set (cover + evenly spaced + newest)
 * so a mid-upload dims sticker is not skipped when only the first/last photos are chosen.
 */
export function pickListingThumbUrlsForExtract(
  photos: readonly { thumbnailUrl?: string | null; url?: string | null; uploadPhase?: string }[],
  max = EXTRACT_LISTING_MAX_IMAGE_URLS,
): string[] {
  const done = photos.filter(
    (p) => p.uploadPhase === "done" && (p.thumbnailUrl?.trim() || p.url?.trim()),
  )
  if (done.length === 0) return []

  const urlAt = (i: number): string => {
    const p = done[i]
    // Prefer full-res for sticker OCR accuracy (server also upgrades -thumb → -full).
    return (p?.url?.trim() || p?.thumbnailUrl?.trim() || "").trim()
  }

  const indices: number[] = []
  if (done.length <= max) {
    for (let i = 0; i < done.length; i++) indices.push(i)
  } else {
    // Stride across the set (not only cover+newest) so a mid-grid dims sticker is included.
    for (let s = 0; s < max; s++) {
      indices.push(Math.floor((s * done.length) / max))
    }
    const last = done.length - 1
    if (!indices.includes(last)) {
      indices[indices.length - 1] = last
    }
  }

  const urls: string[] = []
  const seen = new Set<string>()
  for (const i of indices) {
    const u = urlAt(i)
    if (!u || seen.has(u)) continue
    seen.add(u)
    urls.push(u)
  }
  return urls
}

export function allExtractTargetFieldsFilled(current: ExtractListingFormSlice): boolean {
  const dimsFacetsFilled = EXTRACT_LISTING_DIM_FACET_KEYS.every((k) => !isEmpty(current[k]))
  const brandFilled = !isEmpty(current.brand) || !isEmpty(current.boardBrandId)
  return dimsFacetsFilled && brandFilled
}

/** Clear AI ownership for all directory-brand keys when the seller edits brand. */
export function clearBrandAiFilledKeys(
  prev: readonly ExtractListingAiFieldKey[],
): ExtractListingAiFieldKey[] {
  const brandSet = new Set<string>(EXTRACT_LISTING_BRAND_KEYS)
  return prev.filter((k) => !brandSet.has(k))
}
