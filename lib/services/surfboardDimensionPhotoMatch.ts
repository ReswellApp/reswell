import "server-only"

import { generateText, Output } from "ai"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  insertSurfboardDimensionPhotoMatch,
  listDimensionPhotoPickTrainingExamples,
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
  formatGoodPickExampleCaption,
  formatRefFewShotCaption,
  surfboardDimensionPhotoJevMemorySnippet,
  surfboardDimensionPhotoMemoryPromptBlock,
} from "@/lib/services/surfboardDimensionPhotoMemory"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"
import type { SurfboardDimensionPhotoSurface } from "@/lib/validations/surfboardDimensionPhoto"

/** Vision OCR needs stamp detail — allow larger originals than UI thumbs. */
const VISION_IMAGE_MAX_BYTES = 8_000_000

const observationSchema = z.object({
  /** 0-based index of the photo that shows the printed dimensions. Null if none. */
  dimensionPhotoIndex: z.number().int().nullable().optional(),
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

function feature() {
  const row = APP_LLM_FEATURES.find((item) => item.id === "surfboard_dimension_photo")
  if (!row) throw new Error("surfboard_dimension_photo is missing from APP_LLM_FEATURES")
  return row
}

export function isSurfboardDimensionPhotoMatchEnabled(): boolean {
  return isAppLlmFeatureEnabled(feature())
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

function coerceObservation(
  raw: unknown,
  photoCount: number,
): DimensionPhotoObservation | null {
  const parsed = observationSchema.safeParse(raw)
  if (!parsed.success) return null
  const o = parsed.data
  let index =
    typeof o.dimensionPhotoIndex === "number" && Number.isFinite(o.dimensionPhotoIndex)
      ? Math.trunc(o.dimensionPhotoIndex)
      : null
  if (index != null && (index < 0 || index >= photoCount)) index = null
  return {
    dimensionPhotoIndex: index,
    lengthText: emptyToNull(o.lengthText)?.slice(0, 32) ?? null,
    widthText: emptyToNull(o.widthText)?.slice(0, 32) ?? null,
    thicknessText: emptyToNull(o.thicknessText)?.slice(0, 32) ?? null,
    volumeText: emptyToNull(o.volumeText)?.slice(0, 32) ?? null,
    confidence: coerceConfidence(o.confidence),
    summary: emptyToNull(o.summary)?.slice(0, 400) ?? "No summary.",
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

const SYSTEM_PROMPT = `You read surfboard dimensions from photos for Reswell. Dimensions only — never brand or model.

Your job (in order):
1) PHOTO PICK — Find which gallery photo shows the printed dimensions.
2) DIMS READ — Read length, width, thickness (and volume only if printed) from THAT photo only.
3) Set dimensionPhotoIndex to the 0-based index of that photo.

What a CORRECT dimensions photo looks like:
- Close-up of size stamp, stringer handwriting, tail block, or manufacturer label
- Visible measurement text: feet/inches, often with × or x between L / W / T
- Often centered on the wood stringer or a small label — not a distant full-board shot

What is NOT a dimensions photo (never pick these when a stamp exists):
- Lifestyle / beach beauty shots of the whole board
- Outline silhouettes or top-down shape with no readable numbers
- Logo / brand / model name only
- Fin boxes, leash plugs, or rail details without L×W×T text

Rules:
- Prefer the tightest readable stamp close-up over any full-board shot.
- Never invent dimensions. If you cannot read them, leave measurement fields null and confidence low.
- Do not estimate size from board outline alone when a dimensions photo is present.
- Do not use any catalog or listing metadata — only what is visible in the images.
- Volume is optional. Most stamps show only L × W × T. If liters are not printed on the chosen photo, volumeText MUST be null — never estimate.

lengthText: e.g. 6'2. Null when unknown.
widthText: inches, e.g. 19 1/4. Null when unknown.
thicknessText: inches, e.g. 2 1/2. Null when unknown.
volumeText: liters number ONLY when clearly printed (e.g. 32L, 28.5). Otherwise null. Never invent.
confidence: high when the stamp is clearly readable; medium when partially readable; low otherwise.
summary: one sentence naming which photo index had the stamp and what you read.`

export type SurfboardDimensionPhotoMatchOutcome =
  | {
      ok: true
      observation: DimensionPhotoObservation
      match: SurfboardDimensionPhotoMatchRow
      references: SurfboardDimensionPhotoRefRow[]
    }
  | { ok: false; error: string; status: 422 | 503 }

async function runDimensionVision(input: {
  supabase: SupabaseClient
  shots: DimensionPhotoMatchImage[]
  includeRefs: boolean
}): Promise<
  | {
      ok: true
      observation: DimensionPhotoObservation
      usedRefs: SurfboardDimensionPhotoRefRow[]
      fewShotImagesIncluded: boolean
    }
  | { ok: false; error: string; status: 422 | 503 }
> {
  if (!isSurfboardDimensionPhotoMatchEnabled()) {
    return { ok: false, error: "Dimension photo matching is not configured.", status: 503 }
  }
  if (input.shots.length < 1 || input.shots.some((s) => s.bytes.byteLength < 1)) {
    return { ok: false, error: "Add at least one surfboard photo.", status: 422 }
  }

  const [memoryBlock, pickExamples] = await Promise.all([
    surfboardDimensionPhotoMemoryPromptBlock(input.supabase),
    input.includeRefs
      ? listDimensionPhotoPickTrainingExamples(input.supabase, {
          goodLimit: 3,
          badLimit: 3,
        })
      : Promise.resolve({ good: [], bad: [] }),
  ])

  const content: Array<
    | { type: "text"; text: string }
    | { type: "file"; mediaType: string; data: Uint8Array }
  > = [
    {
      type: "text",
      text: "First pick the photo index that shows the printed size stamp, then read L × W × T from that photo only. Leave volumeText null unless liters are printed on that same photo. Use the GOOD/BAD example images below as the standard for photo picking.",
    },
  ]

  if (memoryBlock) content.push({ type: "text", text: memoryBlock })

  // Contrastive vision few-shot: show actual rejected picks (most important for photo accuracy).
  let badPickShown = 0
  for (const row of pickExamples.bad) {
    const url = row.sourceImageUrl?.trim()
    if (!url) continue
    const fetched = await fetchBestListingVisionBytes({ url })
    if (!fetched) continue
    content.push({ type: "text", text: formatBadPickExampleCaption(badPickShown) })
    content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
    badPickShown += 1
    if (badPickShown >= 3) break
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
    if (goodPickShown >= 3) break
  }

  let usedRefs: SurfboardDimensionPhotoRefRow[] = []
  if (input.includeRefs) {
    const refs = await listSurfboardDimensionPhotoRefsForFewShot(input.supabase, { limit: 6 })
    for (const ref of refs) {
      // Skip refs that duplicate a good-pick example we already attached.
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
      content.push({ type: "text", text: formatRefFewShotCaption(ref, usedRefs.length - 1) })
      content.push({ type: "file", mediaType: fetched.mediaType, data: fetched.bytes })
      if (usedRefs.length >= 3) break
    }
  }

  content.push({
    type: "text",
    text: `Now score THIS listing's photos (${input.shots.length}). Indices are 0-based. Pick dimensionPhotoIndex among these only.`,
  })
  input.shots.forEach((shot, index) => {
    content.push({ type: "text", text: `Photo index ${index} (${shot.shot}).` })
    content.push({ type: "file", mediaType: shot.mediaType, data: shot.bytes })
  })

  try {
    const { output } = await generateText({
      model: resolveConfiguredModel(feature()),
      output: Output.object({ schema: observationSchema }),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      temperature: 0,
      maxOutputTokens: 700,
      maxRetries: 1,
      timeout: 55_000,
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("surfboard_dimension_photo"),
        },
      },
    })
    const observation = coerceObservation(output, input.shots.length)
    if (!observation) {
      return {
        ok: false,
        error: "Could not read those photos. Try a clearer dimensions close-up.",
        status: 422,
      }
    }
    return {
      ok: true,
      observation,
      usedRefs,
      fewShotImagesIncluded: (badPickShown + goodPickShown + usedRefs.length) > 0,
    }
  } catch (err) {
    console.error(
      "[surfboardDimensionPhotoMatch] vision failed:",
      err instanceof Error ? err.message : err,
    )
    return {
      ok: false,
      error: "Could not read those photos. Try a clearer dimensions close-up.",
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
}): Promise<SurfboardDimensionPhotoMatchOutcome> {
  const includeRefs = input.includeRefs !== false
  // Listing scans: cheap first pass, Jev may request one few-shot retry.
  // Admin uploads already benefit from few-shot on the first call.
  const lightFirst = input.surface === "listing_scan"

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
  // Photo Good + Dims Good → promote the model's own read (no manual corrections).
  const shouldPromote =
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
    promotedRefId,
  })
}
