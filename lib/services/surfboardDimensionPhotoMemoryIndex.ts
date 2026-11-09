import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeImageDhash, isDimensionPhotoPhash } from "@/lib/media/image-phash"
import {
  listActiveDimensionPhotoMemoryIndex,
  listRatedSurfboardDimensionPhotoMemory,
  upsertDimensionPhotoMemoryIndexRows,
  type SurfboardDimensionPhotoMatchRow,
  type SurfboardDimensionPhotoMemoryIndexRow,
} from "@/lib/db/surfboardDimensionPhoto"
import {
  formatDimensionPhotoMemoryCaption,
  inferDimensionPhotoFailureMode,
  inferDimensionPhotoStampStyle,
  lengthBandFromText,
  pickDiverseMemoryRows,
  rankMemoryRowsForQueries,
  type DimensionPhotoMemoryCatalogRow,
} from "@/lib/services/surfboardDimensionPhotoMemoryCatalog"
import type { SurfboardDimensionPhotoMemoryKind } from "@/lib/validations/surfboardDimensionPhoto"

function catalogFromIndexRow(
  row: SurfboardDimensionPhotoMemoryIndexRow,
): DimensionPhotoMemoryCatalogRow {
  return {
    id: row.id,
    kind: row.kind,
    failureMode: row.failureMode,
    stampStyle: row.stampStyle,
    lengthBand: row.lengthBand,
    imageUrl: row.imageUrl,
    phash: row.phash,
    caption: row.caption,
    predictedLength: row.predictedLength,
    predictedWidth: row.predictedWidth,
    predictedThickness: row.predictedThickness,
    predictedVolume: row.predictedVolume,
    actualLength: row.actualLength,
    actualWidth: row.actualWidth,
    actualThickness: row.actualThickness,
    actualVolume: row.actualVolume,
    ratingNote: row.ratingNote,
    updatedAt: row.updatedAt,
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

function httpImageUrl(value: string | null | undefined): string | null {
  const t = emptyToNull(value)
  if (!t || t.startsWith("data:")) return null
  if (!/^https?:\/\//i.test(t)) return null
  return t
}

function stampImageUrl(row: SurfboardDimensionPhotoMatchRow): string | null {
  return (
    httpImageUrl(row.correctedSourceImageUrl) ||
    httpImageUrl(row.sourceImageUrl) ||
    httpImageUrl(row.inputPreview.find((p) => p.shot === "dimensions")?.imageUrl) ||
    httpImageUrl(row.inputPreview[0]?.imageUrl)
  )
}

function buildIndexKinds(row: SurfboardDimensionPhotoMatchRow): SurfboardDimensionPhotoMemoryKind[] {
  const kinds: SurfboardDimensionPhotoMemoryKind[] = []
  if (row.excludedAt) kinds.push("exclude")
  const photo = row.photoRating ?? row.matchRating
  if (photo === "good") kinds.push("photo_good")
  if (photo === "bad") kinds.push("photo_bad")
  if (photo === "bad" && httpImageUrl(row.correctedSourceImageUrl)) kinds.push("photo_good")
  const dims = row.dimsRating ?? row.matchRating
  if (dims === "good") kinds.push("dims_good")
  if (dims === "close") kinds.push("dims_close")
  if (dims === "bad") kinds.push("dims_bad")
  return [...new Set(kinds)]
}

function imageUrlForKind(
  row: SurfboardDimensionPhotoMatchRow,
  kind: SurfboardDimensionPhotoMemoryKind,
): string | null {
  if (kind === "photo_bad") {
    return httpImageUrl(row.sourceImageUrl) || stampImageUrl(row)
  }
  if (kind === "photo_good") {
    return (
      httpImageUrl(row.correctedSourceImageUrl) ||
      httpImageUrl(row.sourceImageUrl) ||
      stampImageUrl(row)
    )
  }
  return stampImageUrl(row)
}

export function memoryRowsFromMatch(
  row: SurfboardDimensionPhotoMatchRow,
  phashByUrl: Map<string, string | null> = new Map(),
): Array<Parameters<typeof upsertDimensionPhotoMemoryIndexRows>[1][number]> {
  const kinds = buildIndexKinds(row)
  const failureMode = inferDimensionPhotoFailureMode({
    photoRating: row.photoRating,
    dimsRating: row.dimsRating,
    summary: row.predictedSummary,
    note: row.ratingNote,
  })
  const stampStyle = inferDimensionPhotoStampStyle(row.predictedSummary)
  const lengthBand = lengthBandFromText(
    row.correctedLength ?? row.predictedLength,
  )
  const out: Array<Parameters<typeof upsertDimensionPhotoMemoryIndexRows>[1][number]> = []

  for (const kind of kinds) {
    const imageUrl = imageUrlForKind(row, kind)
    if (!imageUrl) continue
    const caption = formatDimensionPhotoMemoryCaption({
      kind,
      failureMode,
      predictedLength: row.predictedLength,
      predictedWidth: row.predictedWidth,
      predictedThickness: row.predictedThickness,
      predictedVolume: row.predictedVolume,
      actualLength: row.correctedLength,
      actualWidth: row.correctedWidth,
      actualThickness: row.correctedThickness,
      actualVolume: row.correctedVolume,
      ratingNote: row.ratingNote,
    })
    out.push({
      matchId: row.id,
      refId: row.promotedRefId,
      kind,
      failureMode,
      stampStyle,
      lengthBand,
      imageUrl,
      phash: phashByUrl.get(imageUrl) ?? null,
      caption,
      predictedLength: row.predictedLength,
      predictedWidth: row.predictedWidth,
      predictedThickness: row.predictedThickness,
      predictedVolume: row.predictedVolume,
      actualLength: row.correctedLength,
      actualWidth: row.correctedWidth,
      actualThickness: row.correctedThickness,
      actualVolume: row.correctedVolume,
      ratingNote: row.ratingNote,
      active: true,
    })
  }
  return out
}

async function hashImageUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    return computeImageDhash(bytes)
  } catch {
    return null
  }
}

/**
 * Upsert Good/Bad/Close/Exclude rows for one rated match so the next vision
 * call can retrieve them. Hashing is best-effort — caption rows still index
 * without a phash.
 */
export async function indexRatedDimensionPhotoMatch(
  service: SupabaseClient,
  row: SurfboardDimensionPhotoMatchRow,
): Promise<void> {
  const draft = memoryRowsFromMatch(row)
  if (draft.length === 0) return

  const urls = [...new Set(draft.map((item) => item.imageUrl))]
  const phashByUrl = new Map<string, string | null>()
  await Promise.all(
    urls.map(async (url) => {
      phashByUrl.set(url, await hashImageUrl(url))
    }),
  )

  const rows = memoryRowsFromMatch(row, phashByUrl).map((item) => ({
    ...item,
    phash: isDimensionPhotoPhash(item.phash) ? item.phash : phashByUrl.get(item.imageUrl) ?? null,
  }))
  await upsertDimensionPhotoMemoryIndexRows(service, rows)
}

export async function backfillDimensionPhotoMemoryIndex(
  service: SupabaseClient,
): Promise<number> {
  const rated = await listRatedSurfboardDimensionPhotoMemory(service, { limit: 80 })
  let wrote = 0
  for (const row of rated) {
    const rows = memoryRowsFromMatch(row)
    if (rows.length === 0) continue
    await upsertDimensionPhotoMemoryIndexRows(service, rows)
    wrote += rows.length
  }
  return wrote
}

function retrieveKind(
  rows: DimensionPhotoMemoryCatalogRow[],
  kind: SurfboardDimensionPhotoMemoryKind,
  queryHashes: readonly string[],
  limit: number,
  diversify: "failureMode" | "stampStyle" | "lengthBand",
): DimensionPhotoMemoryCatalogRow[] {
  const subset = rows.filter((row) => row.kind === kind)
  const ranked = rankMemoryRowsForQueries(subset, queryHashes)
  const bucket =
    diversify === "stampStyle"
      ? (row: (typeof ranked)[number]) => row.stampStyle || row.failureMode || "other"
      : diversify === "lengthBand"
        ? (row: (typeof ranked)[number]) => row.lengthBand || "x"
        : (row: (typeof ranked)[number]) => row.failureMode || "other"
  return pickDiverseMemoryRows(ranked, limit, bucket)
}

export type RetrievedDimensionPhotoMemory = {
  catalog: DimensionPhotoMemoryCatalogRow[]
  good: DimensionPhotoMemoryCatalogRow[]
  bad: DimensionPhotoMemoryCatalogRow[]
  excluded: DimensionPhotoMemoryCatalogRow[]
  dimsRefs: DimensionPhotoMemoryCatalogRow[]
}

/**
 * Nearest + diverse examples from the rating index for this gallery.
 * Falls back to backfilling from rated match rows when the index is empty.
 */
const EMPTY_RETRIEVED_MEMORY: RetrievedDimensionPhotoMemory = {
  catalog: [],
  good: [],
  bad: [],
  excluded: [],
  dimsRefs: [],
}

export async function retrieveDimensionPhotoMemory(
  service: SupabaseClient,
  queryHashes: readonly string[],
): Promise<RetrievedDimensionPhotoMemory> {
  let indexed: SurfboardDimensionPhotoMemoryIndexRow[] = []
  try {
    indexed = await listActiveDimensionPhotoMemoryIndex(service, { limit: 180 })
    if (indexed.length === 0) {
      await backfillDimensionPhotoMemoryIndex(service)
      indexed = await listActiveDimensionPhotoMemoryIndex(service, { limit: 180 })
    }
  } catch (error) {
    console.error("[surfboardDimensionPhoto] memory retrieve failed:", error)
    return EMPTY_RETRIEVED_MEMORY
  }

  const catalog = indexed.map(catalogFromIndexRow)
  const good = retrieveKind(catalog, "photo_good", queryHashes, 5, "stampStyle")
  const bad = retrieveKind(catalog, "photo_bad", queryHashes, 6, "failureMode")
  const excluded = retrieveKind(catalog, "exclude", queryHashes, 4, "failureMode")
  const dimsClose = retrieveKind(catalog, "dims_close", queryHashes, 3, "lengthBand")
  const dimsBad = retrieveKind(catalog, "dims_bad", queryHashes, 3, "lengthBand")
  const dimsGood = retrieveKind(catalog, "dims_good", queryHashes, 2, "lengthBand")
  const dimsRefs = [...dimsClose, ...dimsBad, ...dimsGood].filter(
    (row, index, all) => all.findIndex((other) => other.imageUrl === row.imageUrl) === index,
  )

  const catalogForPrompt = [
    ...excluded,
    ...bad,
    ...good,
    ...dimsClose,
    ...dimsBad,
    ...dimsGood,
    ...catalog.filter(
      (row) =>
        ![...excluded, ...bad, ...good, ...dimsClose, ...dimsBad, ...dimsGood].some(
          (picked) => picked.id === row.id,
        ),
    ),
  ]

  return {
    catalog: catalogForPrompt,
    good,
    bad,
    excluded,
    dimsRefs,
  }
}
