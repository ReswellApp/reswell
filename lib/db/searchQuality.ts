import type { SupabaseClient } from "@supabase/supabase-js"
import type { SearchQualityRating, SearchQualitySurface } from "@/lib/validations/searchQuality"

export type SearchQualityListingPreview = {
  id: string
  title: string
  slug: string | null
  price: number | null
  imageUrl: string | null
  boardType: string | null
}

export type SearchQualityRulesSnapshot = {
  brand: string | null
  brandId: string | null
  model: string | null
  styles: string[]
  lengthToken: string | null
  isBrandOnly: boolean
  sectionIntent: string | null
  textQuery: string
}

export type SearchQualityNlSnapshot = {
  skipped: boolean
  reason: string | null
  summary: string
  appliedLabels: string[]
  refine: Record<string, unknown>
  rankedIds?: string[]
  dropIds?: string[]
  extraPhrases?: string[]
}

export type SearchQualityListingRatings = Record<string, SearchQualityRating>

export type SearchQualityEventRow = {
  id: string
  occurredAt: string
  queryDisplay: string
  queryNormalized: string
  searchSurface: SearchQualitySurface
  backend: "elasticsearch" | "supabase" | null
  resultCount: number
  listingIds: string[]
  listingsPreview: SearchQualityListingPreview[]
  listingRatings: SearchQualityListingRatings
  rulesSnapshot: SearchQualityRulesSnapshot
  nlHelper: SearchQualityNlSnapshot | null
  nlSkipped: boolean | null
  resultRating: SearchQualityRating | null
  llmRating: SearchQualityRating | null
  ratingNote: string | null
  ratedBy: string | null
  ratedAt: string | null
}

export type SearchQualityStats = {
  total: number
  rated: number
  unrated: number
  good: number
  close: number
  bad: number
  llmHelped: number
  /** (good + close) / rated. Null when nothing is rated. */
  acceptableRate: number | null
  /** good / rated. */
  goodRate: number | null
  target: number
}

const PREVIEW_CAP = 24

export type InsertSearchQualityEventInput = {
  id: string
  queryDisplay: string
  queryNormalized: string
  searchSurface: SearchQualitySurface
  backend: "elasticsearch" | "supabase" | null
  listingIds: string[]
  listingsPreview: SearchQualityListingPreview[]
  rulesSnapshot: SearchQualityRulesSnapshot
}

function parseListingRatings(raw: unknown): SearchQualityListingRatings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: SearchQualityListingRatings = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "good" || value === "close" || value === "bad") {
      out[id] = value
    }
  }
  return out
}

function mapRow(raw: Record<string, unknown>): SearchQualityEventRow {
  const preview = Array.isArray(raw.listings_preview)
    ? (raw.listings_preview as SearchQualityListingPreview[])
    : []
  const rules =
    raw.rules_snapshot && typeof raw.rules_snapshot === "object"
      ? (raw.rules_snapshot as SearchQualityRulesSnapshot)
      : {
          brand: null,
          brandId: null,
          model: null,
          styles: [],
          lengthToken: null,
          isBrandOnly: false,
          sectionIntent: null,
          textQuery: "",
        }
  const nl =
    raw.nl_helper && typeof raw.nl_helper === "object"
      ? (raw.nl_helper as SearchQualityNlSnapshot)
      : null
  const listingIds = Array.isArray(raw.listing_ids)
    ? (raw.listing_ids as string[]).filter((id) => typeof id === "string")
    : []
  const surface = raw.search_surface === "boards" ? "boards" : "marketplace"
  const backend =
    raw.backend === "elasticsearch" || raw.backend === "supabase" ? raw.backend : null
  const resultRating =
    raw.result_rating === "good" || raw.result_rating === "close" || raw.result_rating === "bad"
      ? raw.result_rating
      : null
  const llmRating =
    raw.llm_rating === "good" || raw.llm_rating === "close" || raw.llm_rating === "bad"
      ? raw.llm_rating
      : null

  return {
    id: String(raw.id),
    occurredAt: String(raw.occurred_at),
    queryDisplay: String(raw.query_display ?? ""),
    queryNormalized: String(raw.query_normalized ?? ""),
    searchSurface: surface,
    backend,
    resultCount: typeof raw.result_count === "number" ? raw.result_count : listingIds.length,
    listingIds,
    listingsPreview: preview.slice(0, PREVIEW_CAP),
    listingRatings: parseListingRatings(raw.listing_ratings),
    rulesSnapshot: {
      brand: rules.brand ?? null,
      brandId: rules.brandId ?? null,
      model: rules.model ?? null,
      styles: Array.isArray(rules.styles) ? rules.styles : [],
      lengthToken: rules.lengthToken ?? null,
      isBrandOnly: Boolean(rules.isBrandOnly),
      sectionIntent: rules.sectionIntent ?? null,
      textQuery: typeof rules.textQuery === "string" ? rules.textQuery : "",
    },
    nlHelper: nl,
    nlSkipped: typeof raw.nl_skipped === "boolean" ? raw.nl_skipped : null,
    resultRating,
    llmRating,
    ratingNote: typeof raw.rating_note === "string" ? raw.rating_note : null,
    ratedBy: typeof raw.rated_by === "string" ? raw.rated_by : null,
    ratedAt: typeof raw.rated_at === "string" ? raw.rated_at : null,
  }
}

const SELECT_COLS =
  "id, occurred_at, query_display, query_normalized, search_surface, backend, result_count, listing_ids, listings_preview, listing_ratings, rules_snapshot, nl_helper, nl_skipped, result_rating, llm_rating, rating_note, rated_by, rated_at"

export async function insertSearchQualityEvent(
  service: SupabaseClient,
  input: InsertSearchQualityEventInput,
): Promise<void> {
  const listingIds = input.listingIds.slice(0, 48)
  const payload = {
    id: input.id,
    query_display: input.queryDisplay.slice(0, 500),
    query_normalized: input.queryNormalized.slice(0, 200),
    search_surface: input.searchSurface,
    backend: input.backend,
    result_count: listingIds.length,
    listing_ids: listingIds,
    listings_preview: input.listingsPreview.slice(0, PREVIEW_CAP),
    rules_snapshot: input.rulesSnapshot,
  }

  const { error } = await service.from("search_quality_events").insert(payload)
  if (!error) return

  // NL helper may have inserted a stub first — fill in listings without clobbering NL.
  if (error.code === "23505") {
    const { error: updateError } = await service
      .from("search_quality_events")
      .update({
        result_count: listingIds.length,
        listing_ids: listingIds,
        listings_preview: payload.listings_preview,
        rules_snapshot: payload.rules_snapshot,
        backend: payload.backend,
        search_surface: payload.search_surface,
      })
      .eq("id", input.id)
    if (updateError) {
      console.error("[searchQuality] update after conflict failed:", updateError.message)
    }
    return
  }

  console.error("[searchQuality] insert failed:", error.message)
}

export async function attachNlHelperToSearchQualityEvent(
  service: SupabaseClient,
  input: {
    eventId: string
    queryDisplay: string
    queryNormalized: string
    snapshot: SearchQualityNlSnapshot
  },
): Promise<void> {
  const nlFields = {
    nl_helper: input.snapshot,
    nl_skipped: input.snapshot.skipped,
  }

  const { data, error } = await service
    .from("search_quality_events")
    .update(nlFields)
    .eq("id", input.eventId)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[searchQuality] attach NL update failed:", error.message)
    return
  }
  if (data?.id) return

  const { error: insertError } = await service.from("search_quality_events").insert({
    id: input.eventId,
    query_display: input.queryDisplay.slice(0, 500),
    query_normalized: input.queryNormalized.slice(0, 200),
    search_surface: "boards",
    result_count: 0,
    listing_ids: [],
    listings_preview: [],
    rules_snapshot: {},
    ...nlFields,
  })
  if (insertError && insertError.code !== "23505") {
    console.error("[searchQuality] attach NL stub insert failed:", insertError.message)
  }
}

export async function rateSearchQualityEvent(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  input: {
    resultRating?: SearchQualityRating | null
    llmRating?: SearchQualityRating | null
    listingId?: string
    listingRating?: SearchQualityRating | null
    note?: string | null
  },
): Promise<{ data: SearchQualityEventRow | null; error: Error | null }> {
  const patch: Record<string, unknown> = {
    rated_by: userId,
    rated_at: new Date().toISOString(),
  }
  if (input.resultRating !== undefined) patch.result_rating = input.resultRating
  if (input.llmRating !== undefined) patch.llm_rating = input.llmRating
  if (input.note !== undefined) patch.rating_note = input.note

  if (input.listingId !== undefined && input.listingRating !== undefined) {
    const { data: existing, error: existingError } = await supabase
      .from("search_quality_events")
      .select("listing_ids, listings_preview, listing_ratings")
      .eq("id", eventId)
      .maybeSingle()
    if (existingError) return { data: null, error: new Error(existingError.message) }
    if (!existing) return { data: null, error: new Error("Event not found") }

    const listingIds = Array.isArray(existing.listing_ids)
      ? (existing.listing_ids as unknown[]).filter((id): id is string => typeof id === "string")
      : []
    const previewIds = Array.isArray(existing.listings_preview)
      ? (existing.listings_preview as Array<{ id?: unknown }>)
          .map((row) => row.id)
          .filter((id): id is string => typeof id === "string")
      : []
    const allowed = new Set([...listingIds, ...previewIds])
    if (!allowed.has(input.listingId)) {
      return { data: null, error: new Error("Listing is not in this search") }
    }

    const next = parseListingRatings(existing.listing_ratings)
    if (input.listingRating == null) {
      delete next[input.listingId]
    } else {
      next[input.listingId] = input.listingRating
    }
    patch.listing_ratings = next
  }

  const { data, error } = await supabase
    .from("search_quality_events")
    .update(patch)
    .eq("id", eventId)
    .select(SELECT_COLS)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  if (!data) return { data: null, error: new Error("Event not found") }
  return { data: mapRow(data as Record<string, unknown>), error: null }
}

export type ListSearchQualityEventsParams = {
  fromIso: string
  rating: "unrated" | "good" | "close" | "bad" | "all"
  query?: string
  llmOnly?: boolean
  limit: number
  offset: number
}

export async function listSearchQualityEvents(
  supabase: SupabaseClient,
  params: ListSearchQualityEventsParams,
): Promise<{ data: SearchQualityEventRow[]; total: number; error: Error | null }> {
  let q = supabase
    .from("search_quality_events")
    .select(SELECT_COLS, { count: "exact" })
    .gte("occurred_at", params.fromIso)
    .order("occurred_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1)

  if (params.rating === "unrated") {
    q = q.is("result_rating", null)
  } else if (params.rating !== "all") {
    q = q.eq("result_rating", params.rating)
  }

  const needle = params.query?.trim()
  if (needle) {
    q = q.ilike("query_display", `%${needle.replace(/[%_]/g, "")}%`)
  }
  if (params.llmOnly) {
    q = q.eq("nl_skipped", false)
  }

  const { data, error, count } = await q
  if (error) return { data: [], total: 0, error: new Error(error.message) }
  return {
    data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    total: count ?? 0,
    error: null,
  }
}

export async function aggregateSearchQualityStats(
  supabase: SupabaseClient,
  fromIso: string,
): Promise<SearchQualityStats> {
  const { data, error } = await supabase
    .from("search_quality_events")
    .select("result_rating, nl_skipped")
    .gte("occurred_at", fromIso)
    .limit(4000)

  const empty: SearchQualityStats = {
    total: 0,
    rated: 0,
    unrated: 0,
    good: 0,
    close: 0,
    bad: 0,
    llmHelped: 0,
    acceptableRate: null,
    goodRate: null,
    target: 0.95,
  }
  if (error || !data) {
    if (error) console.error("[searchQuality] stats failed:", error.message)
    return empty
  }

  let good = 0
  let close = 0
  let bad = 0
  let unrated = 0
  let llmHelped = 0
  for (const row of data) {
    const rating = row.result_rating
    if (rating === "good") good += 1
    else if (rating === "close") close += 1
    else if (rating === "bad") bad += 1
    else unrated += 1
    if (row.nl_skipped === false) llmHelped += 1
  }
  const total = data.length
  const rated = good + close + bad
  return {
    total,
    rated,
    unrated,
    good,
    close,
    bad,
    llmHelped,
    acceptableRate: rated > 0 ? (good + close) / rated : null,
    goodRate: rated > 0 ? good / rated : null,
    target: 0.95,
  }
}

/** Recent rated rows used as few-shot memory for the NL helper. */
export async function listRatedSearchQualityMemory(
  service: SupabaseClient,
  options?: { queryNormalized?: string; limit?: number },
): Promise<SearchQualityEventRow[]> {
  const limit = options?.limit ?? 24
  const exact = options?.queryNormalized?.trim() ?? ""
  const out: SearchQualityEventRow[] = []
  const seen = new Set<string>()

  const pushRows = (rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const mapped = mapRow(row)
      if (seen.has(mapped.id)) continue
      seen.add(mapped.id)
      out.push(mapped)
      if (out.length >= limit) return
    }
  }

  if (exact) {
    const { data, error } = await service
      .from("search_quality_events")
      .select(SELECT_COLS)
      .eq("query_normalized", exact)
      .not("rated_at", "is", null)
      .order("rated_at", { ascending: false })
      .limit(8)
    if (error) {
      console.error("[searchQuality] memory exact list failed:", error.message)
    } else if (data?.length) {
      pushRows(data as Record<string, unknown>[])
    }
  }

  if (out.length >= limit) return out

  const { data, error } = await service
    .from("search_quality_events")
    .select(SELECT_COLS)
    .not("rated_at", "is", null)
    .order("rated_at", { ascending: false })
    .limit(limit)
  if (error) {
    console.error("[searchQuality] memory list failed:", error.message)
    return out
  }
  pushRows((data ?? []) as Record<string, unknown>[])
  return out
}
