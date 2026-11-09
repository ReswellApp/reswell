import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { SurfboardDimensionPhotoRefRow } from "@/lib/db/surfboardDimensionPhoto"
import {
  buildIndexedMemoryPromptSections,
  type DimensionPhotoMemoryCatalogRow,
} from "@/lib/services/surfboardDimensionPhotoMemoryCatalog"
import { retrieveDimensionPhotoMemory } from "@/lib/services/surfboardDimensionPhotoMemoryIndex"

function dimsLabel(row: {
  boardLength?: string | null
  boardWidthInches?: string | null
  boardThicknessInches?: string | null
  boardVolumeL?: string | null
}): string {
  const parts = [row.boardLength, row.boardWidthInches, row.boardThicknessInches].filter(Boolean)
  const core = parts.join(" × ")
  return row.boardVolumeL ? `${core} · ${row.boardVolumeL}L` : core
}

/**
 * Compact rating memory for Jev state (text only — Jev cannot see images).
 * Pulls from the retrieval index so Good / Close / Bad / Exclude all persist.
 */
export async function surfboardDimensionPhotoJevMemorySnippet(
  service: SupabaseClient,
  queryHashes: readonly string[] = [],
): Promise<string> {
  try {
    const retrieved = await retrieveDimensionPhotoMemory(service, queryHashes)
    if (retrieved.catalog.length === 0) return ""
    return buildIndexedMemoryPromptSections(retrieved.catalog).join("\n").slice(0, 2400)
  } catch (e) {
    console.error("[surfboardDimensionPhoto] Jev memory snippet failed:", e)
    return ""
  }
}

/**
 * Text few-shot from the indexed ratings. Complements image few-shot.
 * This does NOT fine-tune weights — retrieved captions are injected into each call.
 */
export async function surfboardDimensionPhotoMemoryPromptBlock(
  service: SupabaseClient,
  queryHashes: readonly string[] = [],
): Promise<string> {
  try {
    const retrieved = await retrieveDimensionPhotoMemory(service, queryHashes)
    if (retrieved.catalog.length === 0) return ""
    return `\n${buildIndexedMemoryPromptSections(retrieved.catalog).join("\n")}\n`
  } catch (e) {
    console.error("[surfboardDimensionPhoto] memory prompt failed:", e)
    return ""
  }
}

export function formatRefFewShotCaption(row: SurfboardDimensionPhotoRefRow, index: number): string {
  const dims = dimsLabel(row)
  return `GOOD stamp example ${index + 1}: this image IS a dimensions photo (accepted read ${dims}). When a gallery has a similar close-up, pick that index.`
}

export function formatIndexedMemoryImageCaption(row: DimensionPhotoMemoryCatalogRow): string {
  return row.caption
}

export function formatGoodPickExampleCaption(index: number): string {
  return `GOOD stamp example ${index + 1}: admin confirmed this is the correct dimensions photo type (size stamp / stringer writing / tail block). Prefer photos that look like this.`
}

export function formatBadPickExampleCaption(index: number): string {
  return `BAD pick example ${index + 1}: admin rejected this as the dimensions photo. It is NOT a size stamp (likely beauty, outline, or logo). Never set dimensionPhotoIndex to a photo that looks like this when a stamp close-up exists.`
}

export function formatExcludeExampleCaption(index: number): string {
  return `EXCLUDE example ${index + 1}: admin marked this case as not worth matching (no usable stamp, wrong board type, or unreadable forever). If a gallery looks like this, leave dimensionPhotoIndex null — do not force a pick.`
}
