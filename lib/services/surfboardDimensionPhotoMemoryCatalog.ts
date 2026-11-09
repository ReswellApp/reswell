import { minPhashDistanceToQueries } from "@/lib/media/image-phash"
import type { SurfboardDimensionPhotoMemoryKind } from "@/lib/validations/surfboardDimensionPhoto"

export const DIMENSION_PHOTO_FAILURE_MODES = [
  "beauty",
  "outline",
  "logo",
  "fins",
  "faint_ink",
  "fraction",
  "invented_volume",
  "unreadable",
  "other",
] as const
export type DimensionPhotoFailureMode = (typeof DIMENSION_PHOTO_FAILURE_MODES)[number]

export const DIMENSION_PHOTO_STAMP_STYLES = [
  "stringer",
  "tail_block",
  "sticker",
  "unknown",
] as const
export type DimensionPhotoStampStyle = (typeof DIMENSION_PHOTO_STAMP_STYLES)[number]

export type DimensionPhotoMemoryCatalogRow = {
  id: string
  kind: SurfboardDimensionPhotoMemoryKind
  failureMode: string | null
  stampStyle: string | null
  lengthBand: string | null
  imageUrl: string
  phash: string | null
  caption: string
  predictedLength: string | null
  predictedWidth: string | null
  predictedThickness: string | null
  predictedVolume: string | null
  actualLength: string | null
  actualWidth: string | null
  actualThickness: string | null
  actualVolume: string | null
  ratingNote: string | null
  updatedAt: string
}

function dimsLabel(parts: {
  length?: string | null
  width?: string | null
  thickness?: string | null
  volume?: string | null
}): string {
  const core = [parts.length, parts.width, parts.thickness].filter(Boolean).join(" × ")
  if (!core) return ""
  return parts.volume ? `${core} · ${parts.volume}L` : core
}

export function lengthBandFromText(length: string | null | undefined): string {
  const feet = length?.match(/(\d+)/)?.[1]
  return feet ?? "x"
}

export function inferDimensionPhotoFailureMode(input: {
  photoRating?: string | null
  dimsRating?: string | null
  summary?: string | null
  note?: string | null
}): DimensionPhotoFailureMode {
  const blob = `${input.summary ?? ""} ${input.note ?? ""}`.toLowerCase()
  if (/beauty|lifestyle|full[- ]board(?! stamp)/.test(blob)) return "beauty"
  if (/outline|silhouette|shadow/.test(blob)) return "outline"
  if (/logo|decal|brand[- ]only/.test(blob)) return "logo"
  if (/\bfin\b|fin box|rail detail/.test(blob)) return "fins"
  if (/faint|washed|low contrast|hard to read/.test(blob)) return "faint_ink"
  if (/fraction|1\/4|1\/2|3\/8|imprecise/.test(blob) && input.dimsRating === "close") {
    return "fraction"
  }
  if (/volume|invented liters|\bl\b/.test(blob) && input.dimsRating && input.dimsRating !== "good") {
    return "invented_volume"
  }
  if (/unreadable|blur|no stamp|nothing printed/.test(blob)) return "unreadable"
  if (input.photoRating === "bad") return "beauty"
  if (input.dimsRating === "close") return "fraction"
  return "other"
}

export function inferDimensionPhotoStampStyle(summary: string | null | undefined): DimensionPhotoStampStyle {
  const blob = (summary ?? "").toLowerCase()
  if (/stringer|handwrit/.test(blob)) return "stringer"
  if (/tail[- ]?block|tail stamp/.test(blob)) return "tail_block"
  if (/sticker|label|manufacturer/.test(blob)) return "sticker"
  return "unknown"
}

export function formatDimensionPhotoMemoryCaption(input: {
  kind: SurfboardDimensionPhotoMemoryKind
  failureMode?: string | null
  predictedLength?: string | null
  predictedWidth?: string | null
  predictedThickness?: string | null
  predictedVolume?: string | null
  actualLength?: string | null
  actualWidth?: string | null
  actualThickness?: string | null
  actualVolume?: string | null
  ratingNote?: string | null
}): string {
  const predicted = dimsLabel({
    length: input.predictedLength,
    width: input.predictedWidth,
    thickness: input.predictedThickness,
    volume: input.predictedVolume,
  })
  const actual = dimsLabel({
    length: input.actualLength,
    width: input.actualWidth,
    thickness: input.actualThickness,
    volume: input.actualVolume,
  })
  const parts: string[] = []
  switch (input.kind) {
    case "photo_good":
      parts.push("GOOD stamp example: this IS a size-stamp / stringer / tail-block close-up.")
      break
    case "photo_bad":
      parts.push(
        "BAD pick example: NOT a dimensions photo (beauty, outline, logo, or no printed L×W×T).",
      )
      break
    case "dims_good":
      parts.push("DIMS GOOD: keep this precision on similar stamps.")
      break
    case "dims_close":
      parts.push("DIMS CLOSE: nearly right — be more precise on digits/fractions.")
      break
    case "dims_bad":
      parts.push("DIMS BAD: the read was wrong.")
      break
    case "exclude":
      parts.push("EXCLUDE: leave dimensionPhotoIndex null on galleries like this.")
      break
  }
  if (predicted) parts.push(`read ${predicted}`)
  if (actual) parts.push(`actual ${actual} (ground truth)`)
  if (input.kind === "dims_good" && !input.predictedVolume && !input.actualVolume) {
    parts.push("no volume printed (leave volume null)")
  }
  if (input.failureMode && input.failureMode !== "other") {
    parts.push(`mode ${input.failureMode}`)
  }
  if (input.ratingNote?.trim()) parts.push(`admin: ${input.ratingNote.trim()}`)
  return parts.join(" · ").slice(0, 400)
}

export function rankMemoryRowsForQueries<T extends DimensionPhotoMemoryCatalogRow>(
  rows: T[],
  queryHashes: readonly string[],
): Array<T & { retrievalScore: number }> {
  return rows
    .map((row) => ({
      ...row,
      retrievalScore: minPhashDistanceToQueries(row.phash, queryHashes),
    }))
    .sort((a, b) => {
      if (a.retrievalScore !== b.retrievalScore) return a.retrievalScore - b.retrievalScore
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

/**
 * Round-robin across a bucket (failure mode, stamp style, length band) so the
 * prompt is not six near-identical beauty shots.
 */
export function pickDiverseMemoryRows<T extends { retrievalScore: number }>(
  ranked: T[],
  limit: number,
  bucketOf: (row: T) => string,
): T[] {
  if (ranked.length <= limit) return ranked
  const buckets = new Map<string, T[]>()
  for (const row of ranked) {
    const key = bucketOf(row) || "other"
    const list = buckets.get(key) ?? []
    list.push(row)
    buckets.set(key, list)
  }
  const keys = [...buckets.keys()]
  const out: T[] = []
  let guard = 0
  while (out.length < limit && guard < limit * keys.length + 4) {
    for (const key of keys) {
      const next = buckets.get(key)?.shift()
      if (next) out.push(next)
      if (out.length >= limit) break
    }
    guard += 1
  }
  return out
}

export function buildIndexedMemoryPromptSections(rows: DimensionPhotoMemoryCatalogRow[]): string[] {
  const byKind = (kind: SurfboardDimensionPhotoMemoryKind) => rows.filter((r) => r.kind === kind)
  const photoGood = byKind("photo_good")
  const photoBad = byKind("photo_bad")
  const dimsGood = byKind("dims_good")
  const dimsClose = byKind("dims_close")
  const dimsBad = byKind("dims_bad")
  const excluded = byKind("exclude")
  const closeCorrected = dimsClose.filter((r) => r.actualLength && r.actualWidth && r.actualThickness)
  const badCorrected = dimsBad.filter((r) => r.actualLength && r.actualWidth && r.actualThickness)

  const sections: string[] = [
    "Indexed admin memory (retrieved for THIS call — follow it):",
    "PHOTO PICK: Good = stamp/stringer/tail-block with readable L×W×T. Bad = beauty/outline/logo/no measurements.",
    "DIMS: Good keep, Close tighten to actual, Bad use actual as ground truth. Volume null unless printed.",
    "EXCLUDE: leave index null rather than guessing.",
  ]

  const push = (title: string, list: DimensionPhotoMemoryCatalogRow[], n: number) => {
    if (list.length === 0) return
    sections.push(title)
    for (const row of list.slice(0, n)) sections.push(`- ${row.caption}`)
  }

  push("Recent EXCLUDED cases (skip similar):", excluded, 8)
  push("BAD photo picks (do not choose frames like these):", photoBad, 12)
  push("GOOD photo picks (prefer frames like these):", photoGood, 10)
  push(
    "Ground-truth corrections (Close/Bad dims with actual L×W×T):",
    [...closeCorrected, ...badCorrected],
    12,
  )
  push("DIMS GOOD (keep this precision):", dimsGood, 8)
  push("DIMS CLOSE (tighten):", dimsClose, 8)
  push("DIMS BAD (avoid this read):", dimsBad, 8)

  return sections
}
