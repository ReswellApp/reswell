import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  SurfboardDimensionPhotoJevReview,
  SurfboardDimensionPhotoRating,
  SurfboardDimensionPhotoRefSource,
  SurfboardDimensionPhotoSurface,
} from "@/lib/validations/surfboardDimensionPhoto"
import { SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET } from "@/lib/validations/surfboardDimensionPhoto"

export type SurfboardDimensionPhotoShotPreview = {
  shot: string
  imageUrl: string
}

export type SurfboardDimensionPhotoRefPreview = {
  id: string
  imageUrl: string
  thumbnailUrl: string | null
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string | null
  brandText: string | null
  modelText: string | null
}

export type SurfboardDimensionPhotoRefRow = {
  id: string
  listingId: string | null
  imageUrl: string
  thumbnailUrl: string | null
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string | null
  brandText: string | null
  modelText: string | null
  brandId: string | null
  brandModelId: string | null
  dimensionsRaw: string | null
  source: SurfboardDimensionPhotoRefSource
  active: boolean
  createdAt: string
  updatedAt: string
}

export type SurfboardDimensionPhotoMatchRow = {
  id: string
  occurredAt: string
  surface: SurfboardDimensionPhotoSurface
  inputPreview: SurfboardDimensionPhotoShotPreview[]
  /** Photo the model said contains the printed dimensions. */
  sourceImageUrl: string | null
  predictedLength: string | null
  predictedWidth: string | null
  predictedThickness: string | null
  predictedVolume: string | null
  predictedBrand: string | null
  predictedModel: string | null
  predictedConfidence: "high" | "medium" | "low" | null
  predictedSummary: string | null
  /** Soft Jev post-vision hints — never auto-applies admin ratings. */
  jevReview: SurfboardDimensionPhotoJevReview | null
  referenceIds: string[]
  referencesPreview: SurfboardDimensionPhotoRefPreview[]
  matchRating: SurfboardDimensionPhotoRating | null
  /** Whether the model picked the correct dimensions photo. */
  photoRating: SurfboardDimensionPhotoRating | null
  /** Whether the model read L×W×T correctly. */
  dimsRating: SurfboardDimensionPhotoRating | null
  correctedLength: string | null
  correctedWidth: string | null
  correctedThickness: string | null
  correctedVolume: string | null
  correctedBrand: string | null
  correctedModel: string | null
  ratingNote: string | null
  ratedBy: string | null
  ratedAt: string | null
  promotedRefId: string | null
  listingId: string | null
  /** Prior Bad/Close match this row rematched — both rows are kept. */
  priorMatchId: string | null
  /** When set, do not rematch/re-scan; used as exclude memory. */
  excludedAt: string | null
  excludedBy: string | null
  createdAt: string
}

export type SurfboardDimensionPhotoMatchStats = {
  total: number
  unrated: number
  rated: number
  good: number
  close: number
  bad: number
  /** @deprecated Prefer photoAccuracy / dimsAccuracy / overallAccuracy. */
  acceptableRate: number | null
  target: number
  refCount: number
  /** Photo pick: good / (good + bad). Null until any photo rating exists. */
  photoAccuracy: number | null
  photoRated: number
  photoGood: number
  photoBad: number
  /**
   * Dims read score: (good + 0.5×close) / rated.
   * Close counts as half-credit; Bad is zero.
   */
  dimsAccuracy: number | null
  dimsRated: number
  dimsGood: number
  dimsClose: number
  dimsBad: number
  /** Overall: both aspects Good / rows with both rated. */
  overallAccuracy: number | null
  overallRated: number
  overallGood: number
  excluded: number
}

const REF_SELECT =
  "id, listing_id, image_url, thumbnail_url, board_length, board_width_inches, board_thickness_inches, board_volume_l, brand_text, model_text, brand_id, brand_model_id, dimensions_raw, source, active, created_at, updated_at"

const MATCH_SELECT =
  "id, occurred_at, surface, input_preview, source_image_url, predicted_length, predicted_width, predicted_thickness, predicted_volume, predicted_brand, predicted_model, predicted_confidence, predicted_summary, jev_review, reference_ids, references_preview, match_rating, photo_rating, dims_rating, corrected_length, corrected_width, corrected_thickness, corrected_volume, corrected_brand, corrected_model, rating_note, rated_by, rated_at, promoted_ref_id, listing_id, prior_match_id, excluded_at, excluded_by, created_at"

function parseJevReview(raw: unknown): SurfboardDimensionPhotoJevReview | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const source = row.source === "jev" || row.source === "fallback" ? row.source : null
  if (!source) return null
  const photoVerdict =
    row.photoVerdict === "accept" || row.photoVerdict === "reject" ? row.photoVerdict : null
  const dimsVerdict =
    row.dimsVerdict === "good" || row.dimsVerdict === "close" || row.dimsVerdict === "bad"
      ? row.dimsVerdict
      : null
  const nextAction =
    row.nextAction === "keep" ||
    row.nextAction === "clear_volume" ||
    row.nextAction === "retry_with_examples" ||
    row.nextAction === "distrust"
      ? row.nextAction
      : null
  const volumeNullProbability =
    typeof row.volumeNullProbability === "number" && Number.isFinite(row.volumeNullProbability)
      ? row.volumeNullProbability
      : null
  return {
    source,
    photoVerdict,
    dimsVerdict,
    volumeNullProbability,
    volumeCleared: Boolean(row.volumeCleared),
    nextAction,
    retriedWithExamples: Boolean(row.retriedWithExamples),
    reason: asString(row.reason) ?? "",
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t || null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function parseShotPreview(raw: unknown): SurfboardDimensionPhotoShotPreview[] {
  if (!Array.isArray(raw)) return []
  const out: SurfboardDimensionPhotoShotPreview[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const shot = asString(row.shot)
    const imageUrl = asString(row.imageUrl) ?? asString(row.image_url)
    if (!shot || !imageUrl) continue
    out.push({ shot, imageUrl })
  }
  return out
}

function parseRefPreview(raw: unknown): SurfboardDimensionPhotoRefPreview[] {
  if (!Array.isArray(raw)) return []
  const out: SurfboardDimensionPhotoRefPreview[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const id = asString(row.id)
    const imageUrl = asString(row.imageUrl) ?? asString(row.image_url)
    const boardLength = asString(row.boardLength) ?? asString(row.board_length)
    const boardWidthInches =
      asString(row.boardWidthInches) ?? asString(row.board_width_inches)
    const boardThicknessInches =
      asString(row.boardThicknessInches) ?? asString(row.board_thickness_inches)
    if (!id || !imageUrl || !boardLength || !boardWidthInches || !boardThicknessInches) {
      continue
    }
    out.push({
      id,
      imageUrl,
      thumbnailUrl: asString(row.thumbnailUrl) ?? asString(row.thumbnail_url),
      boardLength,
      boardWidthInches,
      boardThicknessInches,
      boardVolumeL: asString(row.boardVolumeL) ?? asString(row.board_volume_l),
      brandText: asString(row.brandText) ?? asString(row.brand_text),
      modelText: asString(row.modelText) ?? asString(row.model_text),
    })
  }
  return out
}

function mapRef(raw: Record<string, unknown>): SurfboardDimensionPhotoRefRow {
  return {
    id: String(raw.id),
    listingId: asString(raw.listing_id),
    imageUrl: String(raw.image_url ?? ""),
    thumbnailUrl: asString(raw.thumbnail_url),
    boardLength: String(raw.board_length ?? ""),
    boardWidthInches: String(raw.board_width_inches ?? ""),
    boardThicknessInches: String(raw.board_thickness_inches ?? ""),
    boardVolumeL: asString(raw.board_volume_l),
    brandText: asString(raw.brand_text),
    modelText: asString(raw.model_text),
    brandId: asString(raw.brand_id),
    brandModelId: asString(raw.brand_model_id),
    dimensionsRaw: asString(raw.dimensions_raw),
    source: (asString(raw.source) ?? "listing_seed") as SurfboardDimensionPhotoRefSource,
    active: Boolean(raw.active),
    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
  }
}

function mapMatch(raw: Record<string, unknown>): SurfboardDimensionPhotoMatchRow {
  const confidence = asString(raw.predicted_confidence)
  return {
    id: String(raw.id),
    occurredAt: String(raw.occurred_at ?? ""),
    surface: (asString(raw.surface) ?? "admin_test") as SurfboardDimensionPhotoSurface,
    inputPreview: parseShotPreview(raw.input_preview),
    sourceImageUrl: asString(raw.source_image_url),
    predictedLength: asString(raw.predicted_length),
    predictedWidth: asString(raw.predicted_width),
    predictedThickness: asString(raw.predicted_thickness),
    predictedVolume: asString(raw.predicted_volume),
    predictedBrand: asString(raw.predicted_brand),
    predictedModel: asString(raw.predicted_model),
    predictedConfidence:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : null,
    predictedSummary: asString(raw.predicted_summary),
    jevReview: parseJevReview(raw.jev_review),
    referenceIds: asStringArray(raw.reference_ids),
    referencesPreview: parseRefPreview(raw.references_preview),
    matchRating: (asString(raw.match_rating) as SurfboardDimensionPhotoRating | null) ?? null,
    photoRating: (asString(raw.photo_rating) as SurfboardDimensionPhotoRating | null) ?? null,
    dimsRating: (asString(raw.dims_rating) as SurfboardDimensionPhotoRating | null) ?? null,
    correctedLength: asString(raw.corrected_length),
    correctedWidth: asString(raw.corrected_width),
    correctedThickness: asString(raw.corrected_thickness),
    correctedVolume: asString(raw.corrected_volume),
    correctedBrand: asString(raw.corrected_brand),
    correctedModel: asString(raw.corrected_model),
    ratingNote: asString(raw.rating_note),
    ratedBy: asString(raw.rated_by),
    ratedAt: asString(raw.rated_at),
    promotedRefId: asString(raw.promoted_ref_id),
    listingId: asString(raw.listing_id),
    priorMatchId: asString(raw.prior_match_id),
    excludedAt: asString(raw.excluded_at),
    excludedBy: asString(raw.excluded_by),
    createdAt: String(raw.created_at ?? ""),
  }
}

export function refPreviewFromRow(
  row: SurfboardDimensionPhotoRefRow,
): SurfboardDimensionPhotoRefPreview {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    thumbnailUrl: row.thumbnailUrl,
    boardLength: row.boardLength,
    boardWidthInches: row.boardWidthInches,
    boardThicknessInches: row.boardThicknessInches,
    boardVolumeL: row.boardVolumeL,
    brandText: row.brandText,
    modelText: row.modelText,
  }
}

export async function listSurfboardDimensionPhotoRefs(
  service: SupabaseClient,
  options: {
    q?: string
    active?: boolean | "all"
    limit?: number
    offset?: number
  } = {},
): Promise<{ data: SurfboardDimensionPhotoRefRow[]; total: number; error: Error | null }> {
  const limit = options.limit ?? 60
  const offset = options.offset ?? 0
  let query = service
    .from("surfboard_dimension_photo_refs")
    .select(REF_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (options.active !== "all") {
    query = query.eq("active", options.active !== false)
  }

  const q = options.q?.trim()
  if (q) {
    query = query.or(
      `board_length.ilike.%${q}%,board_width_inches.ilike.%${q}%,board_thickness_inches.ilike.%${q}%,board_volume_l.ilike.%${q}%`,
    )
  }

  const { data, error, count } = await query
  if (error) {
    return { data: [], total: 0, error: new Error(error.message) }
  }
  return {
    data: ((data ?? []) as Record<string, unknown>[]).map(mapRef),
    total: count ?? 0,
    error: null,
  }
}

export async function countActiveSurfboardDimensionPhotoRefs(
  service: SupabaseClient,
): Promise<number> {
  const { count, error } = await service
    .from("surfboard_dimension_photo_refs")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
  if (error) {
    console.error("[surfboardDimensionPhoto] ref count failed:", error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Diverse active refs for few-shot vision (spread across length bands).
 * Only admin-accepted vision reads — never listing_seed copies of listings.dimensions.
 */
export async function listSurfboardDimensionPhotoRefsForFewShot(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<SurfboardDimensionPhotoRefRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 6, 1), 12)
  const { data, error } = await service
    .from("surfboard_dimension_photo_refs")
    .select(REF_SELECT)
    .eq("active", true)
    .in("source", ["match_accepted", "manual", "listing_scan"])
    .order("updated_at", { ascending: false })
    .limit(80)

  if (error) {
    console.error("[surfboardDimensionPhoto] few-shot list failed:", error.message)
    return []
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapRef)
  if (rows.length <= limit) return rows

  const bands = new Map<string, SurfboardDimensionPhotoRefRow[]>()
  for (const row of rows) {
    const feet = row.boardLength.match(/^(\d+)/)?.[1] ?? "x"
    const list = bands.get(feet) ?? []
    list.push(row)
    bands.set(feet, list)
  }

  const out: SurfboardDimensionPhotoRefRow[] = []
  const keys = [...bands.keys()].sort()
  let guard = 0
  while (out.length < limit && guard < limit * keys.length + 4) {
    for (const key of keys) {
      const list = bands.get(key)
      const next = list?.shift()
      if (next) out.push(next)
      if (out.length >= limit) break
    }
    guard += 1
  }
  return out
}

export async function upsertSurfboardDimensionPhotoRef(
  service: SupabaseClient,
  input: {
    listingId?: string | null
    imageUrl: string
    thumbnailUrl?: string | null
    boardLength: string
    boardWidthInches: string
    boardThicknessInches: string
    boardVolumeL?: string | null
    brandText?: string | null
    modelText?: string | null
    brandId?: string | null
    brandModelId?: string | null
    dimensionsRaw?: string | null
    source: SurfboardDimensionPhotoRefSource
    active?: boolean
  },
): Promise<{ data: SurfboardDimensionPhotoRefRow | null; error: Error | null }> {
  const payload = {
    listing_id: input.listingId ?? null,
    image_url: input.imageUrl.trim(),
    thumbnail_url: input.thumbnailUrl?.trim() || null,
    board_length: input.boardLength.trim(),
    board_width_inches: input.boardWidthInches.trim(),
    board_thickness_inches: input.boardThicknessInches.trim(),
    board_volume_l: input.boardVolumeL?.trim() || null,
    brand_text: input.brandText?.trim() || null,
    model_text: input.modelText?.trim() || null,
    brand_id: input.brandId ?? null,
    brand_model_id: input.brandModelId ?? null,
    dimensions_raw: input.dimensionsRaw?.trim() || null,
    source: input.source,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  }

  if (input.listingId) {
    const { data: existing, error: existingError } = await service
      .from("surfboard_dimension_photo_refs")
      .select("id")
      .eq("listing_id", input.listingId)
      .maybeSingle()
    if (existingError) return { data: null, error: new Error(existingError.message) }

    if (existing?.id) {
      const { data, error } = await service
        .from("surfboard_dimension_photo_refs")
        .update(payload)
        .eq("id", existing.id)
        .select(REF_SELECT)
        .maybeSingle()
      if (error) return { data: null, error: new Error(error.message) }
      return { data: data ? mapRef(data as Record<string, unknown>) : null, error: null }
    }
  }

  const { data, error } = await service
    .from("surfboard_dimension_photo_refs")
    .insert(payload)
    .select(REF_SELECT)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: data ? mapRef(data as Record<string, unknown>) : null, error: null }
}

export async function patchSurfboardDimensionPhotoRef(
  service: SupabaseClient,
  id: string,
  patch: {
    active?: boolean
    boardLength?: string
    boardWidthInches?: string
    boardThicknessInches?: string
    boardVolumeL?: string | null
  },
): Promise<{ data: SurfboardDimensionPhotoRefRow | null; error: Error | null }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.active !== undefined) update.active = patch.active
  if (patch.boardLength !== undefined) update.board_length = patch.boardLength
  if (patch.boardWidthInches !== undefined) update.board_width_inches = patch.boardWidthInches
  if (patch.boardThicknessInches !== undefined) {
    update.board_thickness_inches = patch.boardThicknessInches
  }
  if (patch.boardVolumeL !== undefined) update.board_volume_l = patch.boardVolumeL

  const { data, error } = await service
    .from("surfboard_dimension_photo_refs")
    .update(update)
    .eq("id", id)
    .select(REF_SELECT)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: data ? mapRef(data as Record<string, unknown>) : null, error: null }
}

export async function insertSurfboardDimensionPhotoMatch(
  service: SupabaseClient,
  input: {
    surface: SurfboardDimensionPhotoSurface
    inputPreview: SurfboardDimensionPhotoShotPreview[]
    sourceImageUrl?: string | null
    predictedLength?: string | null
    predictedWidth?: string | null
    predictedThickness?: string | null
    predictedVolume?: string | null
    predictedBrand?: string | null
    predictedModel?: string | null
    predictedConfidence?: "high" | "medium" | "low" | null
    predictedSummary?: string | null
    jevReview?: SurfboardDimensionPhotoJevReview | null
    referenceIds?: string[]
    referencesPreview?: SurfboardDimensionPhotoRefPreview[]
    listingId?: string | null
    priorMatchId?: string | null
  },
): Promise<{ data: SurfboardDimensionPhotoMatchRow | null; error: Error | null }> {
  const { data, error } = await service
    .from("surfboard_dimension_photo_matches")
    .insert({
      surface: input.surface,
      input_preview: input.inputPreview,
      source_image_url: input.sourceImageUrl?.trim() || null,
      predicted_length: input.predictedLength ?? null,
      predicted_width: input.predictedWidth ?? null,
      predicted_thickness: input.predictedThickness ?? null,
      predicted_volume: input.predictedVolume ?? null,
      predicted_brand: input.predictedBrand ?? null,
      predicted_model: input.predictedModel ?? null,
      predicted_confidence: input.predictedConfidence ?? null,
      predicted_summary: input.predictedSummary ?? null,
      jev_review: input.jevReview ?? null,
      reference_ids: input.referenceIds ?? [],
      references_preview: input.referencesPreview ?? [],
      listing_id: input.listingId ?? null,
      prior_match_id: input.priorMatchId ?? null,
    })
    .select(MATCH_SELECT)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data ? mapMatch(data as Record<string, unknown>) : null, error: null }
}

function matchNeedsRematch(row: {
  photoRating: SurfboardDimensionPhotoRating | null
  dimsRating: SurfboardDimensionPhotoRating | null
}): boolean {
  if (row.photoRating === "bad") return true
  if (row.dimsRating === "bad" || row.dimsRating === "close") return true
  return false
}

/**
 * Latest Bad/Close matches that do not already have a newer rematch pending or succeeding.
 * One candidate per listing_id (or per match id when listing_id is null).
 */
export async function listDimensionPhotoRematchCandidates(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<SurfboardDimensionPhotoMatchRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 40)

  const { data, error } = await service
    .from("surfboard_dimension_photo_matches")
    .select(MATCH_SELECT)
    .not("rated_at", "is", null)
    .is("excluded_at", null)
    .or("photo_rating.eq.bad,dims_rating.eq.bad,dims_rating.eq.close")
    .order("occurred_at", { ascending: false })
    .limit(400)

  if (error) {
    console.error("[surfboardDimensionPhoto] rematch candidates failed:", error.message)
    return []
  }

  const failures = ((data ?? []) as Record<string, unknown>[]).map(mapMatch)
  if (failures.length === 0) return []

  // Newer matches that already rematched a failure (or a fresher run for the same listing).
  const priorIds = failures.map((f) => f.id)
  const { data: children } = await service
    .from("surfboard_dimension_photo_matches")
    .select("prior_match_id, listing_id, occurred_at, photo_rating, dims_rating")
    .in("prior_match_id", priorIds)

  const rematchedPriors = new Set(
    (children ?? [])
      .map((r) => (r as { prior_match_id?: string | null }).prior_match_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  // Latest match per listing — if it's already unrated or fully good, don't queue again.
  const { data: recentByListing } = await service
    .from("surfboard_dimension_photo_matches")
    .select("id, listing_id, occurred_at, photo_rating, dims_rating")
    .not("listing_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(800)

  const latestByListing = new Map<
    string,
    {
      id: string
      occurredAt: string
      photoRating: string | null
      dimsRating: string | null
    }
  >()
  for (const raw of recentByListing ?? []) {
    const r = raw as {
      id: string
      listing_id: string | null
      occurred_at: string
      photo_rating: string | null
      dims_rating: string | null
    }
    if (!r.listing_id || latestByListing.has(r.listing_id)) continue
    latestByListing.set(r.listing_id, {
      id: r.id,
      occurredAt: r.occurred_at,
      photoRating: r.photo_rating,
      dimsRating: r.dims_rating,
    })
  }

  const out: SurfboardDimensionPhotoMatchRow[] = []
  const seenListings = new Set<string>()

  for (const failure of failures) {
    if (!matchNeedsRematch(failure)) continue
    if (rematchedPriors.has(failure.id)) continue

    if (failure.listingId) {
      if (seenListings.has(failure.listingId)) continue
      const latest = latestByListing.get(failure.listingId)
      if (latest && latest.id !== failure.id) {
        // Newer run exists for this listing.
        const latestUnrated = latest.photoRating == null || latest.dimsRating == null
        const latestGood = latest.photoRating === "good" && latest.dimsRating === "good"
        if (latestUnrated || latestGood) continue
        // Newer run is also bad/close but wasn't in failure list order — still skip duplicate listing.
        if (latest.occurredAt > failure.occurredAt) continue
      }
      seenListings.add(failure.listingId)
    }

    out.push(failure)
    if (out.length >= limit) break
  }

  return out
}

export async function listSurfboardDimensionPhotoMatches(
  service: SupabaseClient,
  options: {
    fromIso: string
    rating?: "unrated" | "good" | "close" | "bad" | "excluded" | "all"
    surface?: "all" | SurfboardDimensionPhotoSurface
    limit?: number
    offset?: number
  },
): Promise<{ data: SurfboardDimensionPhotoMatchRow[]; total: number; error: Error | null }> {
  const limit = options.limit ?? 40
  const offset = options.offset ?? 0
  let query = service
    .from("surfboard_dimension_photo_matches")
    .select(MATCH_SELECT, { count: "exact" })
    .gte("occurred_at", options.fromIso)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (options.surface && options.surface !== "all") {
    query = query.eq("surface", options.surface)
  }

  if (options.rating === "excluded") {
    query = query.not("excluded_at", "is", null)
  } else if (options.rating !== "all") {
    query = query.is("excluded_at", null)
  }

  if (options.rating === "unrated") {
    // Needs either photo pick or dims read still rated.
    query = query.or("photo_rating.is.null,dims_rating.is.null")
  } else if (options.rating === "good") {
    query = query.eq("photo_rating", "good").eq("dims_rating", "good")
  } else if (options.rating === "bad") {
    query = query.or("photo_rating.eq.bad,dims_rating.eq.bad")
  } else if (options.rating === "close") {
    query = query.or("photo_rating.eq.close,dims_rating.eq.close")
  }

  const { data, error, count } = await query
  if (error) return { data: [], total: 0, error: new Error(error.message) }
  return {
    data: ((data ?? []) as Record<string, unknown>[]).map(mapMatch),
    total: count ?? 0,
    error: null,
  }
}

export async function getSurfboardDimensionPhotoMatch(
  service: SupabaseClient,
  id: string,
): Promise<SurfboardDimensionPhotoMatchRow | null> {
  const { data, error } = await service
    .from("surfboard_dimension_photo_matches")
    .select(MATCH_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) {
    console.error("[surfboardDimensionPhoto] get match failed:", error.message)
    return null
  }
  return data ? mapMatch(data as Record<string, unknown>) : null
}

function deriveOverallMatchRating(
  photo: SurfboardDimensionPhotoRating | null | undefined,
  dims: SurfboardDimensionPhotoRating | null | undefined,
): SurfboardDimensionPhotoRating | null {
  if (photo === "bad" || dims === "bad") return "bad"
  if (photo === "good" && dims === "good") return "good"
  if (photo === "close" || dims === "close") return "close"
  return null
}

export async function rateSurfboardDimensionPhotoMatch(
  service: SupabaseClient,
  id: string,
  ratedBy: string,
  input: {
    matchRating?: SurfboardDimensionPhotoRating | null
    photoRating?: SurfboardDimensionPhotoRating | null
    dimsRating?: SurfboardDimensionPhotoRating | null
    note?: string | null
    excluded?: boolean
    correctedLength?: string | null
    correctedWidth?: string | null
    correctedThickness?: string | null
    correctedVolume?: string | null
    promotedRefId?: string | null
  },
): Promise<{ data: SurfboardDimensionPhotoMatchRow | null; error: Error | null }> {
  const { data: existing, error: existingError } = await service
    .from("surfboard_dimension_photo_matches")
    .select("photo_rating, dims_rating, match_rating")
    .eq("id", id)
    .maybeSingle()
  if (existingError) return { data: null, error: new Error(existingError.message) }

  const nextPhoto =
    input.photoRating !== undefined
      ? input.photoRating
      : input.matchRating !== undefined
        ? input.matchRating
        : ((existing as { photo_rating?: string | null } | null)?.photo_rating as
            | SurfboardDimensionPhotoRating
            | null
            | undefined) ?? null
  const nextDims =
    input.dimsRating !== undefined
      ? input.dimsRating
      : input.matchRating !== undefined
        ? input.matchRating
        : ((existing as { dims_rating?: string | null } | null)?.dims_rating as
            | SurfboardDimensionPhotoRating
            | null
            | undefined) ?? null

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = {
    rated_by: ratedBy,
    rated_at: nowIso,
    photo_rating: nextPhoto,
    dims_rating: nextDims,
    match_rating: deriveOverallMatchRating(nextPhoto, nextDims),
  }
  if (input.excluded === true) {
    patch.excluded_at = nowIso
    patch.excluded_by = ratedBy
    // Excluded is not Bad for accuracy — leave photo/dims as-is unless also set.
  } else if (input.excluded === false) {
    patch.excluded_at = null
    patch.excluded_by = null
  }
  if (input.note !== undefined) patch.rating_note = input.note
  if (input.correctedLength !== undefined) patch.corrected_length = input.correctedLength
  if (input.correctedWidth !== undefined) patch.corrected_width = input.correctedWidth
  if (input.correctedThickness !== undefined) {
    patch.corrected_thickness = input.correctedThickness
  }
  if (input.correctedVolume !== undefined) patch.corrected_volume = input.correctedVolume
  if (input.promotedRefId !== undefined) patch.promoted_ref_id = input.promotedRefId

  const { data, error } = await service
    .from("surfboard_dimension_photo_matches")
    .update(patch)
    .eq("id", id)
    .select(MATCH_SELECT)
    .maybeSingle()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: data ? mapMatch(data as Record<string, unknown>) : null, error: null }
}

export async function aggregateSurfboardDimensionPhotoMatchStats(
  service: SupabaseClient,
  fromIso: string,
): Promise<SurfboardDimensionPhotoMatchStats> {
  const [{ data, error }, refCount] = await Promise.all([
    service
      .from("surfboard_dimension_photo_matches")
      .select("match_rating, photo_rating, dims_rating, excluded_at")
      .gte("occurred_at", fromIso),
    countActiveSurfboardDimensionPhotoRefs(service),
  ])

  if (error) {
    console.error("[surfboardDimensionPhoto] stats failed:", error.message)
    return emptyDimensionPhotoMatchStats(refCount)
  }

  let unrated = 0
  let good = 0
  let close = 0
  let bad = 0
  let excluded = 0
  let photoGood = 0
  let photoBad = 0
  let dimsGood = 0
  let dimsClose = 0
  let dimsBad = 0
  let overallGood = 0
  let overallRated = 0

  for (const row of data ?? []) {
    const r = row as {
      match_rating?: string | null
      photo_rating?: string | null
      dims_rating?: string | null
      excluded_at?: string | null
    }
    if (r.excluded_at) {
      excluded += 1
      continue
    }
    const photo = r.photo_rating ?? null
    const dims = r.dims_rating ?? null

    if (photo === "good") photoGood += 1
    else if (photo === "bad") photoBad += 1

    if (dims === "good") dimsGood += 1
    else if (dims === "close") dimsClose += 1
    else if (dims === "bad") dimsBad += 1

    if (photo == null || dims == null) {
      unrated += 1
    } else {
      overallRated += 1
      if (photo === "good" && dims === "good") {
        good += 1
        overallGood += 1
      } else if (photo === "bad" || dims === "bad") {
        bad += 1
      } else {
        close += 1
      }
    }
  }

  const total = (data ?? []).length
  const rated = good + close + bad
  const photoRated = photoGood + photoBad
  const dimsRated = dimsGood + dimsClose + dimsBad
  const dimsScore = dimsGood + dimsClose * 0.5

  return {
    total,
    unrated,
    rated,
    good,
    close,
    bad,
    excluded,
    acceptableRate: rated > 0 ? (good + close) / rated : null,
    target: SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET,
    refCount,
    photoAccuracy: photoRated > 0 ? photoGood / photoRated : null,
    photoRated,
    photoGood,
    photoBad,
    dimsAccuracy: dimsRated > 0 ? dimsScore / dimsRated : null,
    dimsRated,
    dimsGood,
    dimsClose,
    dimsBad,
    overallAccuracy: overallRated > 0 ? overallGood / overallRated : null,
    overallRated,
    overallGood,
  }
}

function emptyDimensionPhotoMatchStats(refCount: number): SurfboardDimensionPhotoMatchStats {
  return {
    total: 0,
    unrated: 0,
    rated: 0,
    good: 0,
    close: 0,
    bad: 0,
    excluded: 0,
    acceptableRate: null,
    target: SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET,
    refCount,
    photoAccuracy: null,
    photoRated: 0,
    photoGood: 0,
    photoBad: 0,
    dimsAccuracy: null,
    dimsRated: 0,
    dimsGood: 0,
    dimsClose: 0,
    dimsBad: 0,
    overallAccuracy: null,
    overallRated: 0,
    overallGood: 0,
  }
}

/** Recent rated matches used as text few-shot memory. */
export async function listRatedSurfboardDimensionPhotoMemory(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<SurfboardDimensionPhotoMatchRow[]> {
  const limit = options.limit ?? 28
  // Include excluded + rated; excluded rows teach "skip similar".
  const { data, error } = await service
    .from("surfboard_dimension_photo_matches")
    .select(MATCH_SELECT)
    .or("rated_at.not.is.null,excluded_at.not.is.null")
    .order("rated_at", { ascending: false, nullsFirst: false })
    .limit(limit)
  if (error) {
    console.error("[surfboardDimensionPhoto] memory list failed:", error.message)
    return []
  }
  return ((data ?? []) as Record<string, unknown>[]).map(mapMatch)
}

/**
 * Rated photo-picks with a stored source image — used as contrastive vision few-shot
 * (Good = this is a stamp photo; Bad = do not pick photos like this).
 */
export async function listDimensionPhotoPickTrainingExamples(
  service: SupabaseClient,
  options: { goodLimit?: number; badLimit?: number; excludeLimit?: number } = {},
): Promise<{
  good: SurfboardDimensionPhotoMatchRow[]
  bad: SurfboardDimensionPhotoMatchRow[]
  excluded: SurfboardDimensionPhotoMatchRow[]
}> {
  const goodLimit = Math.min(Math.max(options.goodLimit ?? 3, 1), 6)
  const badLimit = Math.min(Math.max(options.badLimit ?? 3, 1), 6)
  const excludeLimit = Math.min(Math.max(options.excludeLimit ?? 3, 1), 6)

  const [goodRes, badRes, excludeRes] = await Promise.all([
    service
      .from("surfboard_dimension_photo_matches")
      .select(MATCH_SELECT)
      .eq("photo_rating", "good")
      .is("excluded_at", null)
      .not("source_image_url", "is", null)
      .order("rated_at", { ascending: false })
      .limit(goodLimit * 3),
    service
      .from("surfboard_dimension_photo_matches")
      .select(MATCH_SELECT)
      .eq("photo_rating", "bad")
      .is("excluded_at", null)
      .not("source_image_url", "is", null)
      .order("rated_at", { ascending: false })
      .limit(badLimit * 3),
    service
      .from("surfboard_dimension_photo_matches")
      .select(MATCH_SELECT)
      .not("excluded_at", "is", null)
      .not("source_image_url", "is", null)
      .order("excluded_at", { ascending: false })
      .limit(excludeLimit * 3),
  ])

  if (goodRes.error) {
    console.error("[surfboardDimensionPhoto] good pick examples failed:", goodRes.error.message)
  }
  if (badRes.error) {
    console.error("[surfboardDimensionPhoto] bad pick examples failed:", badRes.error.message)
  }
  if (excludeRes.error) {
    console.error(
      "[surfboardDimensionPhoto] exclude examples failed:",
      excludeRes.error.message,
    )
  }

  const withUrl = (rows: SurfboardDimensionPhotoMatchRow[]) =>
    rows.filter((r) => Boolean(r.sourceImageUrl?.trim()))

  return {
    good: withUrl(((goodRes.data ?? []) as Record<string, unknown>[]).map(mapMatch)).slice(
      0,
      goodLimit,
    ),
    bad: withUrl(((badRes.data ?? []) as Record<string, unknown>[]).map(mapMatch)).slice(
      0,
      badLimit,
    ),
    excluded: withUrl(((excludeRes.data ?? []) as Record<string, unknown>[]).map(mapMatch)).slice(
      0,
      excludeLimit,
    ),
  }
}

export type ListingGalleryImage = {
  url: string
  thumbnailUrl: string | null
}

export type ListingScanCandidate = {
  listingId: string
  images: ListingGalleryImage[]
}

const LISTING_SCAN_SELECT = `
  id,
  section,
  status,
  hidden_from_site,
  primary_image_url,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`

type ListingScanSourceRow = {
  id: string
  section: string | null
  status: string | null
  hidden_from_site: boolean | null
  primary_image_url: string | null
  listing_images:
    | {
        url: string
        thumbnail_url: string | null
        is_primary: boolean | null
        sort_order: number | null
      }[]
    | null
}

export type SurfboardDimensionPhotoScanSkipReason =
  | "not_found"
  | "not_surfboard"
  | "wrong_status"
  | "missing_image"
  | "already_scanned"
  | "excluded"

/** Live + sold surfboards — sold boards are the richest stamp-photo corpus. */
const SCAN_LISTING_STATUSES = ["active", "sold"] as const

function sortListingGallery(
  images: NonNullable<ListingScanSourceRow["listing_images"]>,
): NonNullable<ListingScanSourceRow["listing_images"]> {
  return [...images].sort((a, b) => {
    const ap = a.is_primary ? 1 : 0
    const bp = b.is_primary ? 1 : 0
    if (ap !== bp) return bp - ap
    return (a.sort_order ?? 999) - (b.sort_order ?? 999)
  })
}

function galleryFromListingRow(row: ListingScanSourceRow): ListingGalleryImage[] {
  const out: ListingGalleryImage[] = []
  const seen = new Set<string>()
  for (const img of sortListingGallery(row.listing_images ?? [])) {
    const url = img.url?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ url, thumbnailUrl: img.thumbnail_url?.trim() || null })
  }
  const primary = row.primary_image_url?.trim()
  if (primary && !seen.has(primary)) {
    out.unshift({ url: primary, thumbnailUrl: null })
  }
  return out.slice(0, 6)
}

export function listingScanCandidateFromRow(
  row: ListingScanSourceRow,
):
  | { ok: true; candidate: ListingScanCandidate }
  | { ok: false; reason: SurfboardDimensionPhotoScanSkipReason } {
  if ((row.section ?? "").trim() !== "surfboards") {
    return { ok: false, reason: "not_surfboard" }
  }
  const status = (row.status ?? "").trim()
  if (!SCAN_LISTING_STATUSES.includes(status as (typeof SCAN_LISTING_STATUSES)[number])) {
    return { ok: false, reason: "wrong_status" }
  }
  // Keep active marketplace listings public-facing; sold can still be hidden from site
  // but we still want their photos for training.
  if (status === "active" && row.hidden_from_site === true) {
    return { ok: false, reason: "wrong_status" }
  }
  const images = galleryFromListingRow(row)
  if (images.length < 1) return { ok: false, reason: "missing_image" }
  return { ok: true, candidate: { listingId: row.id, images } }
}

/** One active/sold surfboard listing → gallery images for vision scan (never uses listings.dimensions). */
export async function getSurfboardListingScanCandidate(
  service: SupabaseClient,
  listingId: string,
): Promise<
  | { ok: true; candidate: ListingScanCandidate }
  | { ok: false; reason: SurfboardDimensionPhotoScanSkipReason | "query_failed" }
> {
  const { data, error } = await service
    .from("listings")
    .select(LISTING_SCAN_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error) {
    console.error("[surfboardDimensionPhoto] listing scan candidate failed:", error.message)
    return { ok: false, reason: "query_failed" }
  }
  if (!data) return { ok: false, reason: "not_found" }

  const { data: excluded } = await service
    .from("surfboard_dimension_photo_matches")
    .select("id")
    .eq("listing_id", listingId)
    .not("excluded_at", "is", null)
    .limit(1)
    .maybeSingle()
  if (excluded?.id) return { ok: false, reason: "excluded" }

  return listingScanCandidateFromRow(data as ListingScanSourceRow)
}

/**
 * Active + sold surfboard listings with photos, skipping ones already scanned.
 * Does not read or require listings.dimensions.
 */
export async function listSurfboardListingsForDimensionPhotoScan(
  service: SupabaseClient,
  options: { limit?: number } = {},
): Promise<ListingScanCandidate[]> {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 40)

  const [{ data: scannedRows }, { data: excludedRows }] = await Promise.all([
    service
      .from("surfboard_dimension_photo_matches")
      .select("listing_id")
      .eq("surface", "listing_scan")
      .not("listing_id", "is", null)
      .limit(5000),
    service
      .from("surfboard_dimension_photo_matches")
      .select("listing_id")
      .not("excluded_at", "is", null)
      .not("listing_id", "is", null)
      .limit(2000),
  ])
  const scanned = new Set(
    (scannedRows ?? [])
      .map((r) => (r as { listing_id?: string | null }).listing_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )
  const excludedListings = new Set(
    (excludedRows ?? [])
      .map((r) => (r as { listing_id?: string | null }).listing_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  )

  // Page through recent active+sold until we fill the batch or exhaust the window.
  const pageSize = 80
  const maxPages = 8
  const out: ListingScanCandidate[] = []
  let offset = 0

  for (let page = 0; page < maxPages && out.length < limit; page++) {
    const { data, error } = await service
      .from("listings")
      .select(LISTING_SCAN_SELECT)
      .eq("section", "surfboards")
      .in("status", [...SCAN_LISTING_STATUSES])
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error("[surfboardDimensionPhoto] scan listings failed:", error.message)
      break
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const raw of rows) {
      const mapped = listingScanCandidateFromRow(raw as ListingScanSourceRow)
      if (!mapped.ok) continue
      if (scanned.has(mapped.candidate.listingId)) continue
      if (excludedListings.has(mapped.candidate.listingId)) continue
      out.push(mapped.candidate)
      if (out.length >= limit) break
    }

    offset += pageSize
    if (rows.length < pageSize) break
  }

  return out
}
