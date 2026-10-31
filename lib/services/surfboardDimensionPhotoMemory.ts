import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listRatedSurfboardDimensionPhotoMemory,
  type SurfboardDimensionPhotoMatchRow,
  type SurfboardDimensionPhotoRefRow,
} from "@/lib/db/surfboardDimensionPhoto"

function dimsLabel(row: {
  boardLength?: string | null
  boardWidthInches?: string | null
  boardThicknessInches?: string | null
  boardVolumeL?: string | null
  predictedLength?: string | null
  predictedWidth?: string | null
  predictedThickness?: string | null
  predictedVolume?: string | null
}): string {
  const length = row.boardLength ?? row.predictedLength
  const width = row.boardWidthInches ?? row.predictedWidth
  const thickness = row.boardThicknessInches ?? row.predictedThickness
  const volume = row.boardVolumeL ?? row.predictedVolume
  const parts = [length, width, thickness].filter(Boolean)
  const core = parts.join(" × ")
  return volume ? `${core} · ${volume}L` : core
}

function formatRatedMemoryLine(row: SurfboardDimensionPhotoMatchRow): string {
  const photo = (row.photoRating ?? row.matchRating ?? "unrated").toUpperCase()
  const dims = (row.dimsRating ?? row.matchRating ?? "unrated").toUpperCase()
  const predicted = dimsLabel({
    predictedLength: row.predictedLength,
    predictedWidth: row.predictedWidth,
    predictedThickness: row.predictedThickness,
    predictedVolume: row.predictedVolume,
  })
  const parts = [
    `photo ${photo}`,
    `dims ${dims}`,
    predicted ? `read ${predicted}` : "read none",
    photo === "BAD"
      ? "wrong photo type (beauty/outline/logo — not the size stamp)"
      : null,
    photo === "GOOD" ? "correct stamp/close-up pick" : null,
    dims === "GOOD" && !row.predictedVolume
      ? "no volume printed (leave volume null)"
      : null,
    dims === "CLOSE" ? "dims nearly right — be more precise on digits/fractions" : null,
    row.ratingNote?.trim() ? `admin: ${row.ratingNote.trim()}` : null,
  ].filter(Boolean)
  return `- ${parts.join(" · ")}`
}

function buildRatedMemorySections(rows: SurfboardDimensionPhotoMatchRow[]): string[] {
  const photoGood = rows.filter(
    (r) => !r.excludedAt && (r.photoRating ?? r.matchRating) === "good",
  )
  const photoBad = rows.filter(
    (r) => !r.excludedAt && (r.photoRating ?? r.matchRating) === "bad",
  )
  const dimsFocus = rows.filter(
    (r) =>
      !r.excludedAt &&
      (r.dimsRating === "good" || r.dimsRating === "close" || r.dimsRating === "bad"),
  )

  const excluded = rows.filter((r) => Boolean(r.excludedAt))

  const sections: string[] = [
    "Admin feedback memory (in-context only — follow it for THIS call):",
    "PHOTO PICK: Good = stamp/stringer/tail-block close-up with readable L×W×T. Bad = lifestyle beauty shot, full-board outline, logo-only, or any frame without printed measurements.",
    "EXCLUDE: admin said do not match cases like these — leave index/fields null rather than guessing.",
  ]

  if (excluded.length > 0) {
    sections.push(
      "Recent EXCLUDED cases (skip similar — do not force a match):",
      ...excluded.slice(0, 6).map((row) => {
        const predicted = dimsLabel({
          predictedLength: row.predictedLength,
          predictedWidth: row.predictedWidth,
          predictedThickness: row.predictedThickness,
          predictedVolume: row.predictedVolume,
        })
        return `- EXCLUDE · ${predicted || "no dims"} · do not rematch`
      }),
    )
  }

  if (photoBad.length > 0) {
    sections.push(
      "Recent BAD photo picks (do not choose frames like these):",
      ...photoBad.filter((r) => !r.excludedAt).slice(0, 8).map(formatRatedMemoryLine),
    )
  }
  if (photoGood.length > 0) {
    sections.push(
      "Recent GOOD photo picks (prefer frames like these):",
      ...photoGood.slice(0, 8).map(formatRatedMemoryLine),
    )
  }
  if (dimsFocus.length > 0) {
    sections.push(
      "DIMS READ (after the right photo is chosen — Good keep, Close tighten, Bad avoid):",
      ...dimsFocus.slice(0, 10).map(formatRatedMemoryLine),
    )
  }

  return sections
}

/**
 * Compact rating memory for Jev state (text only — Jev cannot see images).
 */
export async function surfboardDimensionPhotoJevMemorySnippet(
  service: SupabaseClient,
): Promise<string> {
  try {
    const rows = await listRatedSurfboardDimensionPhotoMemory(service, { limit: 16 })
    if (rows.length === 0) return ""
    return buildRatedMemorySections(rows).join("\n").slice(0, 1800)
  } catch (e) {
    console.error("[surfboardDimensionPhoto] Jev memory snippet failed:", e)
    return ""
  }
}

/**
 * Text few-shot from admin ratings. Complements image few-shot for photo picking.
 * This does NOT fine-tune weights — it is injected into each vision call.
 */
export async function surfboardDimensionPhotoMemoryPromptBlock(
  service: SupabaseClient,
): Promise<string> {
  try {
    const rows = await listRatedSurfboardDimensionPhotoMemory(service, { limit: 28 })
    if (rows.length === 0) return ""
    return `\n${buildRatedMemorySections(rows).join("\n")}\n`
  } catch (e) {
    console.error("[surfboardDimensionPhoto] memory prompt failed:", e)
    return ""
  }
}

export function formatRefFewShotCaption(row: SurfboardDimensionPhotoRefRow, index: number): string {
  const dims = dimsLabel(row)
  return `GOOD stamp example ${index + 1}: this image IS a dimensions photo. Accepted read ${dims}. When a gallery has a similar close-up, pick that index.`
}

export function formatGoodPickExampleCaption(index: number): string {
  return `GOOD stamp example ${index + 1}: admin confirmed this is the correct dimensions photo type (size stamp / stringer writing / tail block). Prefer photos that look like this.`
}

export function formatBadPickExampleCaption(index: number): string {
  return `BAD pick example ${index + 1}: admin rejected this as the dimensions photo. It is NOT a size stamp (likely beauty, outline, or logo). Never set dimensionPhotoIndex to a photo that looks like this when a stamp close-up exists.`
}

export function formatExcludeExampleCaption(index: number): string {
  return `EXCLUDE example ${index + 1}: admin marked this case as not worth matching (no usable stamp, wrong board type, or unreadable forever). If a gallery looks like this, leave dimensionPhotoIndex null and measurement fields null — do not force a match.`
}
