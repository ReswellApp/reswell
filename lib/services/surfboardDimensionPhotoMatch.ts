import "server-only"

import { generateText, Output } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  getSurfboardListingScanCandidate,
  insertSurfboardDimensionPhotoMatch,
  listDimensionPhotoPickTrainingExamples,
  listDimensionPhotoRematchCandidates,
  listSurfboardDimensionPhotoRefsForFewShot,
  listSurfboardListingsForDimensionPhotoScan,
  rateSurfboardDimensionPhotoMatch,
  refPreviewFromRow,
  upsertSurfboardDimensionPhotoRef,
  type SurfboardDimensionPhotoMatchRow,
  type SurfboardDimensionPhotoRefRow,
  type SurfboardDimensionPhotoShotPreview,
} from "@/lib/db/surfboardDimensionPhoto"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { enhanceStampPhotoForVision } from "@/lib/media/enhance-stamp-photo"
import { listingFullImageUrlFromRef } from "@/lib/listing-media-src"
import { sniffSellPhotoMatchMime } from "@/lib/sell-flow/sell-photo-match"
import {
  finalizeDimensionPhotoWithJevReview,
  shouldRetryDimensionPhotoWithExamples,
  verifyDimensionPhotoWithJev,
} from "@/lib/llm/jev-dimension-photo-verify"
import type { DimensionPhotoJevReview } from "@/lib/llm/dimension-photo-verify"
import {
  formatBadPickExampleCaption,
  formatExcludeExampleCaption,
  formatGoodPickExampleCaption,
  formatRefFewShotCaption,
  surfboardDimensionPhotoJevMemorySnippet,
  surfboardDimensionPhotoMemoryPromptBlock,
} from "@/lib/services/surfboardDimensionPhotoMemory"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"
import type { SurfboardDimensionPhotoSurface } from "@/lib/validations/surfboardDimensionPhoto"

/** Vision OCR needs stamp detail — allow larger originals than UI thumbs. */
const VISION_IMAGE_MAX_BYTES = 8_000_000

/**
 * Gemini 2.5 Pro spends budget on thinking before JSON. Tiny caps cause
 * "No object generated: could not parse the response" and empty Unrated scans.
 */
const HARNESS_MAX_OUTPUT_TOKENS = 4096
const PHOTO_PICK_TIMEOUT_MS = 90_000
const DIMS_READ_TIMEOUT_MS = 60_000

/** Stage 1 harness output — photo pick only. */
const photoPickSchema = z.object({
  dimensionPhotoIndex: z.coerce.number().int().nullable().optional(),
  confidence: z.string().optional(),
  summary: z.string().optional(),
})

/** Stage 2 harness output — dims read only. */
const dimsReadSchema = z.object({
  lengthText: z.string().nullable().optional(),
  widthText: z.string().nullable().optional(),
  thicknessText: z.string().nullable().optional(),
  volumeText: z.string().nullable().optional(),
  confidence: z.string().optional(),
  summary: z.string().optional(),
})

export type DimensionPhotoObservation = {
  dimensionPhotoIndex: number | null
  lengthText: string | null
  widthText: string | null
  thicknessText: string | null
  volumeText: string | null
  confidence: "high" | "medium" | "low"
  summary: string
}

export type DimensionPhotoMatchImage = {
  shot: string
  bytes: Uint8Array
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  previewUrl?: string | null
}

function pickFeature() {
  const row = APP_LLM_FEATURES.find((item) => item.id === "surfboard_dimension_photo_pick")
  if (!row) throw new Error("surfboard_dimension_photo_pick is missing from APP_LLM_FEATURES")
  return row
}

function dimsFeature() {
  const row = APP_LLM_FEATURES.find((item) => item.id === "surfboard_dimension_photo")
  if (!row) throw new Error("surfboard_dimension_photo is missing from APP_LLM_FEATURES")
  return row
}

export function isSurfboardDimensionPhotoMatchEnabled(): boolean {
  // Shared enable flag; both stages must be gateway-ready.
  return isAppLlmFeatureEnabled(pickFeature()) && isAppLlmFeatureEnabled(dimsFeature())
}

function emptyToNull(raw: string | null | undefined): string | null {
  const t = raw?.trim()
  return t ? t.slice(0, 160) : null
}

function coerceConfidence(raw: string | undefined): "high" | "medium" | "low" {
  const t = raw?.trim().toLowerCase()
  if (t === "high" || t === "medium" || t === "low") return t
  return "low"
}

function coercePhotoPick(
  raw: unknown,
  photoCount: number,
): { index: number | null; confidence: "high" | "medium" | "low"; summary: string } | null {
  const parsed = photoPickSchema.safeParse(raw)
  if (!parsed.success) return null
  let index =
    typeof parsed.data.dimensionPhotoIndex === "number" &&
    Number.isFinite(parsed.data.dimensionPhotoIndex)
      ? Math.trunc(parsed.data.dimensionPhotoIndex)
      : null
  if (index != null && (index < 0 || index >= photoCount)) index = null
  return {
    index,
    confidence: coerceConfidence(parsed.data.confidence),
    summary: emptyToNull(parsed.data.summary)?.slice(0, 400) ?? "No pick summary.",
  }
}

function coerceDimsRead(raw: unknown): {
  lengthText: string | null
  widthText: string | null
  thicknessText: string | null
  volumeText: string | null
  confidence: "high" | "medium" | "low"
  summary: string
} | null {
  const parsed = dimsReadSchema.safeParse(raw)
  if (!parsed.success) return null
  return {
    lengthText: emptyToNull(parsed.data.lengthText)?.slice(0, 32) ?? null,
    widthText: emptyToNull(parsed.data.widthText)?.slice(0, 32) ?? null,
    thicknessText: emptyToNull(parsed.data.thicknessText)?.slice(0, 32) ?? null,
    volumeText: emptyToNull(parsed.data.volumeText)?.slice(0, 32) ?? null,
    confidence: coerceConfidence(parsed.data.confidence),
    summary: emptyToNull(parsed.data.summary)?.slice(0, 400) ?? "No dims summary.",
  }
}

async function fetchImageBytes(
  url: string,
  maxBytes: number = VISION_IMAGE_MAX_BYTES,
): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength < 256 || bytes.byteLength > maxBytes) return null
    const mediaType = sniffSellPhotoMatchMime(bytes)
    if (!mediaType) return null
    return { bytes, mediaType }
  } catch {
    return null
  }
}

/**
 * Prefer the original / full listing object for stamp OCR; fall back to the
 * thumbnail only if the full file is missing or oversized.
 */
async function fetchBestListingVisionBytes(input: {
  url: string | null | undefined
  thumbnailUrl?: string | null | undefined
}): Promise<{ bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  const full =
    listingFullImageUrlFromRef(input.url) ||
    listingFullImageUrlFromRef(input.thumbnailUrl) ||
    input.url?.trim() ||
    null
  const thumb =
    input.thumbnailUrl?.trim() ||
    (input.url?.includes("-full.") ? input.url.replace("-full.", "-thumb.") : null)

  if (full) {
    const fetched = await fetchImageBytes(full)
    if (fetched) return fetched
  }
  if (thumb && thumb !== full) {
    return fetchImageBytes(thumb)
  }
  return null
}

function extForMediaType(mediaType: string): string {
  if (mediaType === "image/png") return "png"
  if (mediaType === "image/webp") return "webp"
  return "jpg"
}

async function persistShotPreviews(
  supabase: SupabaseClient,
  shots: DimensionPhotoMatchImage[],
): Promise<SurfboardDimensionPhotoShotPreview[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const folder = `dimension-photo-matches/${crypto.randomUUID()}`
  const out: SurfboardDimensionPhotoShotPreview[] = []

  for (const shot of shots) {
    const existing = shot.previewUrl?.trim()
    if (existing && /^https?:\/\//i.test(existing)) {
      out.push({ shot: shot.shot, imageUrl: existing })
      continue
    }
    if (!supabaseUrl) continue

    const path = `${folder}/${shot.shot}.${extForMediaType(shot.mediaType)}`
    const { error } = await supabase.storage.from("listings").upload(path, shot.bytes, {
      upsert: false,
      contentType: shot.mediaType,
      cacheControl: "31536000",
    })
    if (error) {
      console.warn("[surfboardDimensionPhotoMatch] preview upload:", error.message)
      continue
    }
    out.push({ shot: shot.shot, imageUrl: listingObjectPublicUrl(supabaseUrl, path) })
  }

  return out
}

/**
 * Dedicated two-stage harness. This model does ONLY:
 *   (1) pick the stamp photo index
 *   (2) read L×W×T from that photo
 * Nothing else — no brand, model, condition, price, or catalog guesses.
 */
const PHOTO_PICK_SYSTEM = `You are Reswell's stamp-photo picker. ONE job only: choose which gallery photo shows printed surfboard dimensions.

Output ONLY:
- dimensionPhotoIndex: 0-based index of the stamp photo, or null if none / should be excluded
- confidence: high | medium | low
- summary: one short sentence about the pick

CORRECT pick: size stamp, stringer handwriting, tail block, or manufacturer label with readable L×W×T text.
WRONG pick: beauty/lifestyle full-board, outline silhouette, logo-only, fins/rails without measurements.
EXCLUDE-like galleries: leave dimensionPhotoIndex null — do not force a pick.
Never read or invent dimensions in this stage. Never name brand or model.`

const DIMS_READ_SYSTEM = `You are Reswell's dimensions reader. ONE job only: read L×W×T (and volume only if printed) from the provided stamp photo(s).

Output ONLY measurement fields + confidence + a one-sentence summary.
- lengthText e.g. 6'2. Null when unknown.
- widthText inches e.g. 19 1/4. Null when unknown.
- thicknessText inches e.g. 2 1/2. Null when unknown.
- volumeText liters ONLY when clearly printed. Else null — never invent.
Never pick photos. Never guess from outline. Never brand/model. Prefer precise fractions.`

export type SurfboardDimensionPhotoMatchOutcome =
  | {
      ok: true
      observation: DimensionPhotoObservation
      match: SurfboardDimensionPhotoMatchRow
      references: SurfboardDimensionPhotoRefRow[]
    }
  | { ok: false; error: string; status: 422 | 503 }

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; data: Uint8Array }

type DimensionHarnessResult =
  | {
      ok: true
      observation: DimensionPhotoObservation
      usedRefs: SurfboardDimensionPhotoRefRow[]
      fewShotImagesIncluded: boolean
    }
  | { ok: false; error: string; status: 422 | 503 }

function mergeHarnessConfidence(
  pick: "high" | "medium" | "low",
  dims: "high" | "medium" | "low",
): "high" | "medium" | "low" {
  const rank = { low: 0, medium: 1, high: 2 } as const
  return rank[pick] <= rank[dims] ? pick : dims
}

/**
 * Focused harness — two LLM calls, two jobs only:
 *   Stage 1 (photo pick): gallery originals + Good/Bad/Exclude few-shot → index
 *   Stage 2 (dims read): chosen stamp + OCR enhance (+ optional Good OCR refs) → L×W×T
 * Enhance runs only on the picked photo (never the whole gallery).
 */
async function runDimensionVision(input: {
  supabase: SupabaseClient
  shots: DimensionPhotoMatchImage[]
  includeRefs: boolean
}): Promise<DimensionHarnessResult> {
  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return { ok: false, error: "Dimension photo matching is not configured.", status: 503 }
  }
  if (input.shots.length < 1 || input.shots.some((s) => s.bytes.byteLength < 1)) {
    return { ok: false, error: "Add at least one surfboard photo.", status: 422 }
  }

  const pick = await runPhotoPickStage(input)
  if (!pick.ok) return pick

  if (pick.index == null) {
    return {
      ok: true,
      observation: {
        dimensionPhotoIndex: null,
        lengthText: null,
        widthText: null,
        thicknessText: null,
        volumeText: null,
        confidence: pick.confidence,
        summary: pick.summary,
      },
      usedRefs: pick.usedRefs,
      fewShotImagesIncluded: pick.fewShotImagesIncluded,
    }
  }

  const dims = await runDimsReadStage({
    supabase: input.supabase,
    shot: input.shots[pick.index]!,
    index: pick.index,
    includeRefs: input.includeRefs,
  })
  // Soft-fail dims: still save the pick so admin can rate Photo (and Rematch later).
  if (!dims.ok) {
    console.warn(
      "[surfboardDimensionPhotoMatch] dims-read soft-failed after pick; saving pick-only row:",
      dims.error,
    )
    return {
      ok: true,
      observation: {
        dimensionPhotoIndex: pick.index,
        lengthText: null,
        widthText: null,
        thicknessText: null,
        volumeText: null,
        confidence: pick.confidence === "high" ? "medium" : pick.confidence,
        summary: `${pick.summary} Dims read failed — rate the photo pick; use Rematch for dims.`
          .trim()
          .slice(0, 400),
      },
      usedRefs: pick.usedRefs,
      fewShotImagesIncluded: pick.fewShotImagesIncluded,
    }
  }

  return {
    ok: true,
    observation: {
      dimensionPhotoIndex: pick.index,
      lengthText: dims.lengthText,
      widthText: dims.widthText,
      thicknessText: dims.thicknessText,
      volumeText: dims.volumeText,
      confidence: mergeHarnessConfidence(pick.confidence, dims.confidence),
      summary: `${pick.summary} ${dims.summary}`.trim().slice(0, 400),
    },
    usedRefs: [...pick.usedRefs, ...dims.usedRefs],
    fewShotImagesIncluded: pick.fewShotImagesIncluded || dims.fewShotImagesIncluded,
  }
}

async function runPhotoPickStage(input: {
  supabase: SupabaseClient
  shots: DimensionPhotoMatchImage[]
  includeRefs: boolean
}): Promise<
  | {
      ok: true
      index: number | null
      confidence: "high" | "medium" | "low"
      summary: string
      usedRefs: SurfboardDimensionPhotoRefRow[]
      fewShotImagesIncluded: boolean
    }
  | { ok: false; error: string; status: 422 | 503 }
> {
  const [memoryBlock, pickExamples] = await Promise.all([
    surfboardDimensionPhotoMemoryPromptBlock(input.supabase),
    listDimensionPhotoPickTrainingExamples(input.supabase, {
      goodLimit: 4,
      badLimit: 4,
      excludeLimit: 3,
    }),
  ])

  const content: VisionContentPart[] = [
    {
      type: "text",
      text: "PHOTO PICK ONLY. Choose dimensionPhotoIndex for THIS gallery. Do not read or invent L×W×T. Study GOOD / BAD / EXCLUDE examples — EXCLUDE-like galleries → null index.",
    },
  ]
  if (memoryBlock) {
    content.push({
      type: "text",
      text: `Admin photo-pick memory (use for pick quality only — ignore measurement numbers here):\n${memoryBlock}`,
    })
  }

  let excludeShown = 0
  for (const row of pickExamples.excluded) {
    const url = row.sourceImageUrl?.trim()
    if (!url) continue
    const fetched = await fetchBestListingVisionBytes({ url })
    if (!fetched) continue
    content.push({ type: "text", text: formatExcludeExampleCaption(excludeShown) })
    content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
    excludeShown += 1
    if (excludeShown >= 3) break
  }

  let badPickShown = 0
  for (const row of pickExamples.bad) {
    const url = row.sourceImageUrl?.trim()
    if (!url) continue
    const fetched = await fetchBestListingVisionBytes({ url })
    if (!fetched) continue
    content.push({ type: "text", text: formatBadPickExampleCaption(badPickShown) })
    content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
    badPickShown += 1
    if (badPickShown >= 4) break
  }

  let goodPickShown = 0
  for (const row of pickExamples.good) {
    const url = row.sourceImageUrl?.trim()
    if (!url) continue
    const fetched = await fetchBestListingVisionBytes({ url })
    if (!fetched) continue
    content.push({ type: "text", text: formatGoodPickExampleCaption(goodPickShown) })
    content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
    goodPickShown += 1
    if (goodPickShown >= 4) break
  }

  const usedRefs: SurfboardDimensionPhotoRefRow[] = []
  if (input.includeRefs) {
    const refs = await listSurfboardDimensionPhotoRefsForFewShot(input.supabase, { limit: 6 })
    for (const ref of refs) {
      const fetched = await fetchBestListingVisionBytes({
        url: ref.imageUrl,
        thumbnailUrl: ref.thumbnailUrl,
      })
      if (!fetched) continue
      const refUrl = (ref.imageUrl || ref.thumbnailUrl || "").trim()
      if (
        refUrl &&
        pickExamples.good.some(
          (g) => g.sourceImageUrl?.trim() && g.sourceImageUrl.trim() === refUrl,
        )
      ) {
        continue
      }
      usedRefs.push(ref)
      content.push({
        type: "text",
        text: `${formatRefFewShotCaption(ref, usedRefs.length - 1)} (pick-stage: match this photo type only — do not copy its numbers.)`,
      })
      content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
      if (usedRefs.length >= 3) break
    }
  }

  content.push({
    type: "text",
    text: `Gallery to score (${input.shots.length} photos). Indices 0…${input.shots.length - 1}. Return only dimensionPhotoIndex + confidence + summary.`,
  })
  for (let index = 0; index < input.shots.length; index++) {
    const shot = input.shots[index]!
    content.push({ type: "text", text: `Photo index ${index} (${shot.shot}).` })
    content.push({ type: "file", mediaType: shot.mediaType, data: shot.bytes })
  }

  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(pickFeature()),
      output: Output.object({ schema: photoPickSchema }),
      system: PHOTO_PICK_SYSTEM,
      messages: [{ role: "user", content }],
      temperature: 0,
      maxOutputTokens: HARNESS_MAX_OUTPUT_TOKENS,
      maxRetries: 2,
      timeout: PHOTO_PICK_TIMEOUT_MS,
      providerOptions: {
        gateway: {
          tags: [
            ...gatewayTagsForFeature("surfboard_dimension_photo_pick"),
            "stage:photo-pick",
          ],
        },
      },
    })
    const coerced = coercePhotoPick(output, input.shots.length)
    if (!coerced) {
      return {
        ok: false,
        error: "Could not pick a dimensions photo. Try a clearer stamp close-up.",
        status: 422,
      }
    }
    return {
      ok: true,
      index: coerced.index,
      confidence: coerced.confidence,
      summary: coerced.summary,
      usedRefs,
      fewShotImagesIncluded: badPickShown + goodPickShown + excludeShown + usedRefs.length > 0,
    }
  } catch (err) {
    console.error(
      "[surfboardDimensionPhotoMatch] photo-pick stage failed:",
      err instanceof Error ? err.message : err,
    )
    return {
      ok: false,
      error: "Could not pick a dimensions photo. Try a clearer stamp close-up.",
      status: 422,
    }
  }
}

async function runDimsReadStage(input: {
  supabase: SupabaseClient
  shot: DimensionPhotoMatchImage
  index: number
  includeRefs: boolean
}): Promise<
  | {
      ok: true
      lengthText: string | null
      widthText: string | null
      thicknessText: string | null
      volumeText: string | null
      confidence: "high" | "medium" | "low"
      summary: string
      usedRefs: SurfboardDimensionPhotoRefRow[]
      fewShotImagesIncluded: boolean
    }
  | { ok: false; error: string; status: 422 | 503 }
> {
  const content: VisionContentPart[] = [
    {
      type: "text",
      text: `DIMS READ ONLY for stamp photo index ${input.index} (${input.shot.shot}). Read L×W×T from the images below. volumeText null unless liters are printed. Do not pick photos.`,
    },
  ]

  const usedRefs: SurfboardDimensionPhotoRefRow[] = []
  if (input.includeRefs) {
    const refs = await listSurfboardDimensionPhotoRefsForFewShot(input.supabase, { limit: 4 })
    for (const ref of refs) {
      const fetched = await fetchBestListingVisionBytes({
        url: ref.imageUrl,
        thumbnailUrl: ref.thumbnailUrl,
      })
      if (!fetched) continue
      usedRefs.push(ref)
      content.push({
        type: "text",
        text: `OCR style example ${usedRefs.length}: accepted read ${[ref.boardLength, ref.boardWidthInches, ref.boardThicknessInches].filter(Boolean).join(" × ") || "unknown"}. Match this precision; do not invent.`,
      })
      content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
      if (usedRefs.length >= 2) break
    }
  }

  content.push({ type: "text", text: "Stamp photo — original." })
  content.push({ type: "file", mediaType: input.shot.mediaType, data: input.shot.bytes })

  const enhanced = await enhanceStampPhotoForVision(input.shot.bytes)
  if (enhanced) {
    content.push({
      type: "text",
      text: "Same stamp — OCR-enhanced (brightness + contrast + sharpen). Prefer this when the original is faint.",
    })
    content.push({ type: "file", mediaType: enhanced.mediaType, data: enhanced.bytes })
  }

  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(dimsFeature()),
      output: Output.object({ schema: dimsReadSchema }),
      system: DIMS_READ_SYSTEM,
      messages: [{ role: "user", content }],
      temperature: 0,
      maxOutputTokens: HARNESS_MAX_OUTPUT_TOKENS,
      maxRetries: 2,
      timeout: DIMS_READ_TIMEOUT_MS,
      providerOptions: {
        gateway: {
          tags: [
            ...gatewayTagsForFeature("surfboard_dimension_photo"),
            "stage:dims-read",
          ],
        },
      },
    })
    const coerced = coerceDimsRead(output)
    if (!coerced) {
      return {
        ok: false,
        error: "Could not read dimensions from that stamp. Try a clearer close-up.",
        status: 422,
      }
    }
    return {
      ok: true,
      ...coerced,
      usedRefs,
      fewShotImagesIncluded: usedRefs.length > 0,
    }
  } catch (err) {
    console.error(
      "[surfboardDimensionPhotoMatch] dims-read stage failed:",
      err instanceof Error ? err.message : err,
    )
    return {
      ok: false,
      error: "Could not read dimensions from that stamp. Try a clearer close-up.",
      status: 422,
    }
  }
}

async function verifyAndMaybeRetryDimensionVision(input: {
  supabase: SupabaseClient
  shots: DimensionPhotoMatchImage[]
  includeRefs: boolean
  /** Listing scans start light; Jev may request one few-shot retry. */
  lightFirst: boolean
}): Promise<
  | {
      ok: true
      observation: DimensionPhotoObservation
      usedRefs: SurfboardDimensionPhotoRefRow[]
      jevReview: DimensionPhotoJevReview
    }
  | { ok: false; error: string; status: 422 | 503 }
> {
  const firstIncludeRefs = input.lightFirst ? false : input.includeRefs
  let vision = await runDimensionVision({
    supabase: input.supabase,
    shots: input.shots,
    includeRefs: firstIncludeRefs,
  })
  if (!vision.ok) return vision

  const adminMemorySnippet = await surfboardDimensionPhotoJevMemorySnippet(input.supabase)
  const shotLabels = input.shots.map((s, i) => `${i}:${s.shot}`)

  let jevReview = await verifyDimensionPhotoWithJev({
    observation: vision.observation,
    photoCount: input.shots.length,
    shotLabels,
    fewShotImagesIncluded: vision.fewShotImagesIncluded,
    adminMemorySnippet,
  })

  if (
    input.lightFirst &&
    input.includeRefs &&
    shouldRetryDimensionPhotoWithExamples(jevReview)
  ) {
    const retry = await runDimensionVision({
      supabase: input.supabase,
      shots: input.shots,
      includeRefs: true,
    })
    if (retry.ok) {
      vision = retry
      jevReview = await verifyDimensionPhotoWithJev({
        observation: vision.observation,
        photoCount: input.shots.length,
        shotLabels,
        fewShotImagesIncluded: vision.fewShotImagesIncluded,
        adminMemorySnippet,
        retriedWithExamples: true,
      })
      jevReview = { ...jevReview, retriedWithExamples: true }
    }
  }

  const finalized = finalizeDimensionPhotoWithJevReview(vision.observation, jevReview)
  return {
    ok: true,
    observation: finalized.observation,
    usedRefs: vision.usedRefs,
    jevReview: finalized.review,
  }
}

function sourceUrlFromObservation(
  shots: DimensionPhotoMatchImage[],
  preview: SurfboardDimensionPhotoShotPreview[],
  observation: DimensionPhotoObservation,
): string | null {
  const idx = observation.dimensionPhotoIndex
  if (idx == null) {
    const marked = preview.find((p) => p.shot === "dimensions")
    return marked?.imageUrl ?? preview[0]?.imageUrl ?? shots[0]?.previewUrl ?? null
  }
  return (
    preview[idx]?.imageUrl ??
    shots[idx]?.previewUrl?.trim() ??
    preview[0]?.imageUrl ??
    null
  )
}

export async function matchSurfboardDimensionPhotos(input: {
  supabase: SupabaseClient
  surface: SurfboardDimensionPhotoSurface
  shots: DimensionPhotoMatchImage[]
  listingId?: string | null
  includeRefs?: boolean
  /** When rematching a Bad/Close row, link history without overwriting it. */
  priorMatchId?: string | null
}): Promise<SurfboardDimensionPhotoMatchOutcome> {
  const includeRefs = input.includeRefs !== false
  // Listing scans: cheap first pass, Jev may request one few-shot retry.
  // Admin uploads / rematches already benefit from few-shot on the first call.
  const lightFirst = input.surface === "listing_scan" && !input.priorMatchId

  const vision = await verifyAndMaybeRetryDimensionVision({
    supabase: input.supabase,
    shots: input.shots,
    includeRefs,
    lightFirst,
  })
  if (!vision.ok) return vision

  const inputPreview = await persistShotPreviews(input.supabase, input.shots)
  const sourceImageUrl = sourceUrlFromObservation(
    input.shots,
    inputPreview,
    vision.observation,
  )

  // Put the dimensions source first so admin tiles default correctly even before source_image_url.
  const orderedPreview =
    sourceImageUrl != null
      ? [
          { shot: "dimensions", imageUrl: sourceImageUrl },
          ...inputPreview.filter((p) => p.imageUrl !== sourceImageUrl),
        ]
      : inputPreview

  const inserted = await insertSurfboardDimensionPhotoMatch(input.supabase, {
    surface: input.surface,
    inputPreview: orderedPreview,
    sourceImageUrl,
    predictedLength: vision.observation.lengthText,
    predictedWidth: vision.observation.widthText,
    predictedThickness: vision.observation.thicknessText,
    predictedVolume: vision.observation.volumeText,
    predictedConfidence: vision.observation.confidence,
    predictedSummary: vision.observation.summary,
    jevReview: vision.jevReview,
    referenceIds: vision.usedRefs.map((r) => r.id),
    referencesPreview: vision.usedRefs.map(refPreviewFromRow),
    listingId: input.listingId ?? null,
    priorMatchId: input.priorMatchId ?? null,
  })

  if (inserted.error || !inserted.data) {
    console.error("[surfboardDimensionPhotoMatch] insert failed:", inserted.error?.message)
    return {
      ok: false,
      error: "Matched the board but could not save the review row.",
      status: 422,
    }
  }

  return {
    ok: true,
    observation: vision.observation,
    match: inserted.data,
    references: vision.usedRefs,
  }
}

/**
 * Vision-scan live listing galleries. Does NOT copy listings.dimensions.
 * Creates unrated match rows showing the photo the model read dims from.
 */
export async function scanSurfboardListingsForDimensionPhotos(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<{
  scanned: number
  found: number
  skipped: number
  error: string | null
}> {
  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return {
      scanned: 0,
      found: 0,
      skipped: 0,
      error: "Dimension photo matching is not configured.",
    }
  }

  const candidates = await listSurfboardListingsForDimensionPhotoScan(service, {
    limit: options.limit ?? 12,
  })
  let scanned = 0
  let found = 0
  let skipped = 0

  for (const candidate of candidates) {
    scanned += 1
    const shots: DimensionPhotoMatchImage[] = []
    for (let i = 0; i < candidate.images.length; i++) {
      const img = candidate.images[i]!
      const fetched = await fetchBestListingVisionBytes({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
      })
      if (!fetched) continue
      shots.push({
        shot: `photo_${i}`,
        bytes: fetched.bytes,
        mediaType: fetched.mediaType,
        // Keep the full listing URL for admin zoom / promote (not the thumb).
        previewUrl: listingFullImageUrlFromRef(img.url) || img.url,
      })
    }
    if (shots.length < 1) {
      skipped += 1
      continue
    }

    const result = await matchSurfboardDimensionPhotos({
      supabase: service,
      surface: "listing_scan",
      shots,
      listingId: candidate.listingId,
      // Listing scans learn from scratch; few-shot refs only after Good ratings exist.
      includeRefs: true,
    })

    if (!result.ok) {
      skipped += 1
      continue
    }
    if (result.observation.lengthText || result.observation.widthText) found += 1
    else skipped += 1
  }

  return { scanned, found, skipped, error: null }
}

/**
 * Re-run vision on Bad / Close matches. Keeps the prior row and inserts a new
 * unrated match linked via prior_match_id (history for first vs next attempt).
 */
export async function rematchSurfboardDimensionPhotoFailures(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<{
  attempted: number
  created: number
  skipped: number
  error: string | null
}> {
  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return {
      attempted: 0,
      created: 0,
      skipped: 0,
      error: "Dimension photo matching is not configured.",
    }
  }

  const priors = await listDimensionPhotoRematchCandidates(service, {
    limit: options.limit ?? 12,
  })
  let attempted = 0
  let created = 0
  let skipped = 0

  for (const prior of priors) {
    attempted += 1
    const shots: DimensionPhotoMatchImage[] = []

    if (prior.listingId) {
      const candidate = await getSurfboardListingScanCandidate(service, prior.listingId)
      if (candidate.ok) {
        for (let i = 0; i < candidate.candidate.images.length; i++) {
          const img = candidate.candidate.images[i]!
          const fetched = await fetchBestListingVisionBytes({
            url: img.url,
            thumbnailUrl: img.thumbnailUrl,
          })
          if (!fetched) continue
          shots.push({
            shot: `photo_${i}`,
            bytes: fetched.bytes,
            mediaType: fetched.mediaType,
            previewUrl: listingFullImageUrlFromRef(img.url) || img.url,
          })
        }
      }
    }

    // Fallback: re-use the prior run's stored gallery / source photo.
    if (shots.length < 1) {
      const urls: string[] = []
      if (prior.sourceImageUrl?.trim()) urls.push(prior.sourceImageUrl.trim())
      for (const preview of prior.inputPreview) {
        const u = preview.imageUrl?.trim()
        if (u && !urls.includes(u)) urls.push(u)
      }
      for (let i = 0; i < urls.length; i++) {
        const fetched = await fetchBestListingVisionBytes({ url: urls[i]! })
        if (!fetched) continue
        shots.push({
          shot: `prior_${i}`,
          bytes: fetched.bytes,
          mediaType: fetched.mediaType,
          previewUrl: urls[i]!,
        })
      }
    }

    if (shots.length < 1) {
      skipped += 1
      continue
    }

    const result = await matchSurfboardDimensionPhotos({
      supabase: service,
      surface: prior.listingId ? "listing_scan" : prior.surface,
      shots,
      listingId: prior.listingId,
      priorMatchId: prior.id,
      includeRefs: true,
    })

    if (!result.ok) {
      skipped += 1
      continue
    }
    created += 1
  }

  return { attempted, created, skipped, error: null }
}

/** @deprecated Use {@link scanSurfboardListingsForDimensionPhotos}. */
export async function seedSurfboardDimensionPhotoRefsFromListings(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<{ inserted: number; updated: number; skipped: number; error: string | null }> {
  const result = await scanSurfboardListingsForDimensionPhotos(service, options)
  return {
    inserted: result.found,
    updated: 0,
    skipped: result.skipped + Math.max(0, result.scanned - result.found - result.skipped),
    error: result.error,
  }
}

export async function rateAndMaybePromoteDimensionPhotoMatch(input: {
  supabase: SupabaseClient
  matchId: string
  ratedBy: string
  matchRating?: "good" | "close" | "bad" | null
  photoRating?: "good" | "close" | "bad" | null
  dimsRating?: "good" | "close" | "bad" | null
  note?: string | null
  excluded?: boolean
  promoteToRefs?: boolean
}): Promise<{ data: SurfboardDimensionPhotoMatchRow | null; error: Error | null }> {
  const existing = await input.supabase
    .from("surfboard_dimension_photo_matches")
    .select(
      "id, listing_id, input_preview, source_image_url, predicted_length, predicted_width, predicted_thickness, predicted_volume, match_rating, photo_rating, dims_rating, promoted_ref_id",
    )
    .eq("id", input.matchId)
    .maybeSingle()

  if (existing.error || !existing.data) {
    return { data: null, error: new Error(existing.error?.message ?? "Match not found") }
  }

  const row = existing.data as {
    listing_id: string | null
    input_preview: unknown
    source_image_url: string | null
    predicted_length: string | null
    predicted_width: string | null
    predicted_thickness: string | null
    predicted_volume: string | null
    photo_rating: string | null
    dims_rating: string | null
    promoted_ref_id: string | null
  }

  const nextPhoto =
    input.photoRating !== undefined
      ? input.photoRating
      : input.matchRating !== undefined
        ? input.matchRating
        : (row.photo_rating as "good" | "close" | "bad" | null)
  const nextDims =
    input.dimsRating !== undefined
      ? input.dimsRating
      : input.matchRating !== undefined
        ? input.matchRating
        : (row.dims_rating as "good" | "close" | "bad" | null)

  let promotedRefId: string | null | undefined = undefined
  // Excluded cases never promote. Photo Good + Dims Good → promote the model's own read.
  const shouldPromote =
    input.excluded !== true &&
    input.promoteToRefs !== false &&
    nextPhoto === "good" &&
    nextDims === "good" &&
    !row.promoted_ref_id

  if (shouldPromote) {
    const length = emptyToNull(row.predicted_length)
    const width = emptyToNull(row.predicted_width)
    const thickness = emptyToNull(row.predicted_thickness)
    const preview = Array.isArray(row.input_preview) ? row.input_preview : []
    const sourceFromPreview = preview.find(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as { shot?: string }).shot === "dimensions",
    ) as { imageUrl?: string; image_url?: string } | undefined
    const imageUrl =
      emptyToNull(row.source_image_url) ||
      emptyToNull(sourceFromPreview?.imageUrl) ||
      emptyToNull(sourceFromPreview?.image_url) ||
      (preview[0] && typeof preview[0] === "object"
        ? emptyToNull((preview[0] as { imageUrl?: string }).imageUrl)
        : null)

    if (length && width && thickness && imageUrl && !imageUrl.startsWith("data:")) {
      const promoted = await upsertSurfboardDimensionPhotoRef(input.supabase, {
        listingId: row.listing_id,
        imageUrl,
        boardLength: length,
        boardWidthInches: width,
        boardThicknessInches: thickness,
        boardVolumeL: emptyToNull(row.predicted_volume),
        source: "match_accepted",
        active: true,
      })
      if (promoted.data) promotedRefId = promoted.data.id
    }
  }

  return rateSurfboardDimensionPhotoMatch(input.supabase, input.matchId, input.ratedBy, {
    matchRating: input.matchRating,
    photoRating: input.photoRating,
    dimsRating: input.dimsRating,
    note: input.note,
    excluded: input.excluded,
    promotedRefId,
  })
}
