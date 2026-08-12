/**
 * Structured parse of marketplace free-text search into brand / model / length
 * filters plus residual keyword text. Rules-based (no LLM) — shared by nav suggest,
 * `/search`, and `/boards`.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  searchBrandModelsForBrandId,
  searchBrandModelsWithBrandsForSuggest,
} from "@/lib/db/brand-models"
import { totalBoardLengthInchesFromCombinedInput } from "@/lib/board-measurements"
import { lengthTotalInchesFromListingTitle } from "@/lib/listing-browse-facet-measurements"
import {
  resolveDirectoryBrandRowFromLabel,
  type DirectoryBrandMini,
} from "@/lib/services/brandDirectorySearch"
import { expansionsForMarketplaceQuery } from "@/lib/services/searchSynonyms"
import type { ElasticsearchIndexedListingSection } from "@/lib/elasticsearch/listing-sections"
import {
  extractMarketplaceSectionIntent,
  isBrandOnlyMarketplaceSuggestQuery,
  isMarketplaceSearchNoiseToken,
  isMarketplaceSectionOnlyQuery,
  residualMarketplaceQueryAfterBrand,
  stripMarketplaceSearchNoiseWords,
} from "@/lib/utils/marketplace-brand-query"
import { matchModelFromTitle } from "@/lib/utils/listing-brand-model-match"

export type MarketplaceParsedBrand = {
  id: string
  name: string
  slug: string
}

export type MarketplaceParsedModel = {
  id: string
  name: string
  brandId: string
}

export type MarketplaceParsedQuery = {
  raw: string
  /** Noise-stripped query used for residual matching. */
  cleaned: string
  brand: MarketplaceParsedBrand | null
  /** Best catalog model match (exact / phrase / unique completion). Null when sibling variants share the query. */
  model: MarketplaceParsedModel | null
  /** All catalog models matching the model phrase (e.g. Dumpster Diver + Dumpster Diver 2). */
  modelIds: string[]
  lengthInches: number | null
  /** Display token for browse `dimLength` (e.g. `5'10`). */
  lengthToken: string | null
  /** Leftover keyword text after brand / model / length extraction. */
  residualText: string
  /** Text sent to ES/ILIKE — residual when structured filters apply, else cleaned/raw. */
  textQuery: string
  /** True when the query is effectively just a brand name (plus noise words). */
  isBrandOnly: boolean
  /**
   * Listing section implied by query tokens (e.g. "fins" → fins).
   * Callers should scope ES/Supabase section filters when set.
   */
  sectionIntent: ElasticsearchIndexedListingSection | null
  expansions: string[]
}

const LENGTH_TOKEN_RE =
  /(?:^|\s)(\d{1,2})['′]\s*(\d{1,2}(?:\s*\d+\/\d+)?)?(?:"|\u2033)?(?=\s|$)/gu
/** `5 10`, `5.10`, `510` (feet+inches) when users omit the apostrophe. */
const LENGTH_LOOSE_RE =
  /(?:^|\s)(\d{1,2})(?:\s+|\.)(\d{1,2})(?=\s|$)/g
/** `6 foot`, `6 feet`, `6ft`, `6-foot` → exact length in inches (N'0). */
const LENGTH_FEET_WORD_RE =
  /(?:^|\s)(\d{1,2})(?:\s*-?\s*|\s*)(?:feet|foot|ft)\b/gi

/**
 * Length-unit tokens that must never hard-filter to a catalog model on their own.
 * Without this, "6 foot surfboard" → noise-stripped "foot" → "… Regular Foot ASYM".
 */
const MODEL_QUERY_LENGTH_UNIT_STOPWORDS = new Set(["foot", "feet", "ft", "inch", "inches"])

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

export function formatBoardLengthTokenFromInches(totalInches: number): string | null {
  if (!Number.isFinite(totalInches) || totalInches <= 0) return null
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  if (feet < 1 || feet > 15 || inches < 0 || inches >= 12) return null
  return `${feet}'${inches}`
}

function stripPhraseFromQuery(query: string, phrase: string): string {
  const q = query.trim()
  const p = phrase.trim()
  if (!q || !p) return q
  const lower = q.toLowerCase()
  const needle = p.toLowerCase()
  const idx = lower.indexOf(needle)
  if (idx < 0) {
    const tokens = needle.match(/[\w']+/g) ?? []
    let out = q
    for (const token of tokens) {
      if (token.length < 2) continue
      out = out
        .split(/\s+/)
        .filter((t) => t.toLowerCase().replace(/^['']+|['']+$/g, "") !== token)
        .join(" ")
    }
    return collapseWhitespace(out)
  }
  return collapseWhitespace(q.slice(0, idx) + " " + q.slice(idx + needle.length))
}

function extractLengthFromQuery(raw: string): {
  lengthInches: number | null
  lengthToken: string | null
  withoutLength: string
} {
  const fromTitle = lengthTotalInchesFromListingTitle(raw)
  if (fromTitle != null) {
    return {
      lengthInches: fromTitle,
      lengthToken: formatBoardLengthTokenFromInches(fromTitle),
      withoutLength: collapseWhitespace(raw.replace(LENGTH_TOKEN_RE, " ")),
    }
  }

  const loose = LENGTH_LOOSE_RE.exec(raw)
  LENGTH_LOOSE_RE.lastIndex = 0
  if (loose) {
    const combined = `${loose[1]}'${loose[2]}`
    const inches = totalBoardLengthInchesFromCombinedInput(combined)
    if (inches != null) {
      return {
        lengthInches: inches,
        lengthToken: formatBoardLengthTokenFromInches(inches),
        withoutLength: collapseWhitespace(raw.replace(loose[0], " ")),
      }
    }
  }

  LENGTH_FEET_WORD_RE.lastIndex = 0
  const feetWord = LENGTH_FEET_WORD_RE.exec(raw)
  LENGTH_FEET_WORD_RE.lastIndex = 0
  if (feetWord) {
    const combined = `${feetWord[1]}'0`
    const inches = totalBoardLengthInchesFromCombinedInput(combined)
    if (inches != null) {
      return {
        lengthInches: inches,
        lengthToken: formatBoardLengthTokenFromInches(inches),
        withoutLength: collapseWhitespace(raw.replace(feetWord[0], " ")),
      }
    }
  }

  return { lengthInches: null, lengthToken: null, withoutLength: raw.trim() }
}

function modelQueryTokens(modelQuery: string): string[] {
  return (
    modelQuery
      .toLowerCase()
      .match(/[\w']+/g)
      ?.map((t) => t.replace(/^['']+|['']+$/g, ""))
      .filter((t) => t.length >= 2) ?? []
  )
}

/** True when the model search phrase is only a length unit (e.g. leftover "foot"). */
function isLengthUnitOnlyModelQuery(modelQuery: string): boolean {
  const tokens = modelQueryTokens(modelQuery)
  if (tokens.length === 0) return false
  return tokens.every((t) => MODEL_QUERY_LENGTH_UNIT_STOPWORDS.has(t))
}

/**
 * True when leftover text is only generic marketplace words ("board") or length units.
 * "6 foot board" must not hard-filter to "… Softboard …".
 */
function isNoiseOnlyModelQuery(modelQuery: string): boolean {
  const tokens = modelQueryTokens(modelQuery)
  if (tokens.length === 0) return true
  return tokens.every(
    (t) => MODEL_QUERY_LENGTH_UNIT_STOPWORDS.has(t) || isMarketplaceSearchNoiseToken(t),
  )
}

/**
 * Brand/model labels for Applied chips / hard filters must appear in the typed query.
 * Blocks synonym-only and fuzzy catalog accidents from the banner.
 */
export function catalogLabelGroundedInQuery(query: string, label: string | null | undefined): boolean {
  const q = (query || "").trim().toLowerCase()
  const name = (label || "").trim().toLowerCase()
  if (!q || !name) return false
  if (q.includes(name)) return true
  if (name.includes(q) && q.length >= 5 && !isNoiseOnlyModelQuery(q)) return true
  const nameTokens =
    name
      .match(/[\w']+/g)
      ?.map((t) => t.replace(/^['']+|['']+$/g, ""))
      .filter((t) => t.length >= 4 && !isMarketplaceSearchNoiseToken(t)) ?? []
  if (nameTokens.length === 0) return false
  if (nameTokens.length === 1) return q.includes(nameTokens[0]!)
  // Multi-word catalog names: require every distinctive token (e.g. "dumpster diver").
  return nameTokens.every((t) => q.includes(t))
}

/**
 * Ground a catalog model hit against the typed query.
 * Rejects weak substring hits like query "foot" → model "… Regular Foot ASYM".
 */
function modelCandidateGroundedInQuery(query: string, modelName: string): boolean {
  const q = query.trim().toLowerCase()
  const name = modelName.trim().toLowerCase()
  if (!q || !name) return false
  if (name === q) return true
  if (q.includes(name)) return true
  // Partial typeahead ("dumpster" → "Dumpster Diver"): require a distinctive token.
  if (name.includes(q) && q.length >= 5 && !MODEL_QUERY_LENGTH_UNIT_STOPWORDS.has(q)) {
    return true
  }
  return Boolean(
    matchModelFromTitle(query, [{ id: "_", brand_id: "_", name: modelName }]),
  )
}

function toParsedBrand(row: DirectoryBrandMini): MarketplaceParsedBrand {
  return { id: row.id, name: row.name, slug: row.slug }
}

function brandMatchIsGrounded(
  query: string,
  brandName: string,
  expansions: string[],
): boolean {
  const brandOnly = isBrandOnlyMarketplaceSuggestQuery(query, brandName)
  if (brandOnly) return true
  if (query.toLowerCase().includes(brandName.toLowerCase())) return true
  const residual = residualMarketplaceQueryAfterBrand(query, brandName)
  if (residual.length < query.trim().length) return true
  const brandLower = brandName.toLowerCase()
  return expansions.some((e) => {
    const el = e.toLowerCase()
    return el === brandLower || brandLower.includes(el) || el.includes(brandLower)
  })
}

async function resolveBrandForParse(
  supabase: SupabaseClient,
  raw: string,
  withoutLength: string,
  expansions: string[],
  brandHint?: DirectoryBrandMini | null,
): Promise<MarketplaceParsedBrand | null> {
  if (brandHint?.id && brandHint.slug) {
    return toParsedBrand(brandHint)
  }

  const candidates = [withoutLength, raw, ...expansions]
    .map((c) => c.trim())
    .filter((c) => c.length >= 2)

  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = candidate.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const row = await resolveDirectoryBrandRowFromLabel(supabase, candidate)
    if (!row) continue
    if (brandMatchIsGrounded(withoutLength, row.name, expansions)) {
      return toParsedBrand(row)
    }
  }
  return null
}

/**
 * Catalog tokens the shopper did not type. Size letters ("L") are ignored so
 * "John John Florence (L)" stays a family match for "john john florence".
 */
function extraDistinctiveModelTokens(name: string, query: string): string[] {
  const queryTokens = new Set(modelQueryTokens(query))
  return modelQueryTokens(name).filter(
    (t) => !queryTokens.has(t) && t.length >= 3 && !MODEL_QUERY_LENGTH_UNIT_STOPWORDS.has(t),
  )
}

function pickBestModel(
  q: string,
  candidates: MarketplaceParsedModel[],
): MarketplaceParsedModel | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0] ?? null
  const lower = q.toLowerCase()
  const exact = candidates.find((c) => c.name.toLowerCase() === lower)
  if (exact) return exact
  const matched = matchModelFromTitle(
    q,
    candidates.map((c) => ({ id: c.id, brand_id: c.brandId, name: c.name })),
  )
  if (matched) {
    return candidates.find((c) => c.id === matched.id) ?? null
  }
  // Sibling variants share a prefix ("John John Florence Techflex" vs
  // "… Vapor Core Scimitar"). Longest-name wins used to pick one sibling,
  // then ES required that variant's extra tokens and dropped the others.
  const scored = candidates.map((c) => ({
    model: c,
    extra: extraDistinctiveModelTokens(c.name, q).length,
  }))
  const minExtra = Math.min(...scored.map((s) => s.extra))
  const closest = scored.filter((s) => s.extra === minExtra)
  if (closest.length === 1) return closest[0]?.model ?? null
  if (minExtra > 0) return null
  return (
    [...closest].sort((a, b) => a.model.name.length - b.model.name.length)[0]?.model ?? null
  )
}

async function resolveModelsForParse(
  supabase: SupabaseClient,
  brand: MarketplaceParsedBrand | null,
  modelQuery: string,
): Promise<{ model: MarketplaceParsedModel | null; modelIds: string[] }> {
  const q = modelQuery.trim()
  if (q.length < 2) return { model: null, modelIds: [] }
  if (isLengthUnitOnlyModelQuery(q) || isNoiseOnlyModelQuery(q)) {
    return { model: null, modelIds: [] }
  }

  if (brand) {
    const rows = await searchBrandModelsForBrandId(supabase, brand.id, q, 40)
    const candidates: MarketplaceParsedModel[] = rows
      .filter((r) => modelCandidateGroundedInQuery(q, r.name))
      .map((r) => ({ id: r.id, name: r.name, brandId: brand.id }))
    // Also keep phrase matches that ILIKE may miss on ordering.
    for (const r of rows) {
      if (candidates.some((c) => c.id === r.id)) continue
      if (matchModelFromTitle(q, [{ id: r.id, brand_id: brand.id, name: r.name }])) {
        candidates.push({ id: r.id, name: r.name, brandId: brand.id })
      }
    }
    const model = pickBestModel(q, candidates)
    return { model, modelIds: candidates.map((c) => c.id) }
  }

  const rows = await searchBrandModelsWithBrandsForSuggest(supabase, q, 20)
  const candidates: MarketplaceParsedModel[] = rows
    .filter((r) => modelCandidateGroundedInQuery(q, r.name))
    .map((r) => ({ id: r.id, name: r.name, brandId: r.brandId }))
  const model = pickBestModel(q, candidates)
  return { model, modelIds: candidates.map((c) => c.id) }
}

/**
 * Parse a marketplace search string into structured brand/model/length intent.
 */
export async function parseMarketplaceQuery(
  supabase: SupabaseClient,
  rawQuery: string,
  options?: {
    expansions?: string[]
    brandHint?: DirectoryBrandMini | null
  },
): Promise<MarketplaceParsedQuery> {
  const raw = (rawQuery || "").trim().replace(/%/g, "")
  const expansions =
    options?.expansions ?? (raw.length >= 2 ? await expansionsForMarketplaceQuery(raw) : [])

  const sectionIntent = extractMarketplaceSectionIntent(raw)

  if (!raw) {
    return {
      raw: "",
      cleaned: "",
      brand: null,
      model: null,
      modelIds: [],
      lengthInches: null,
      lengthToken: null,
      residualText: "",
      textQuery: "",
      isBrandOnly: false,
      sectionIntent: null,
      expansions,
    }
  }

  const { lengthInches, lengthToken, withoutLength } = extractLengthFromQuery(raw)

  // Bare "fins" / "wetsuits" / etc. are section browse intent — never Futures Fins, etc.
  if (isMarketplaceSectionOnlyQuery(withoutLength) && sectionIntent) {
    return {
      raw,
      cleaned: "",
      brand: null,
      model: null,
      modelIds: [],
      lengthInches,
      lengthToken,
      residualText: "",
      textQuery: "",
      isBrandOnly: false,
      sectionIntent,
      expansions,
    }
  }

  // Never fall back to noise-only leftovers ("board") — that matched Softboard / Foot models.
  const cleaned = stripMarketplaceSearchNoiseWords(withoutLength)

  const brand = await resolveBrandForParse(
    supabase,
    raw,
    withoutLength,
    expansions,
    options?.brandHint,
  )

  // Text left after removing the brand name. Empty ⇒ brand-only intent (e.g. "channel islands").
  // Do not fall back to `cleaned` for model search — that reintroduces brand tokens and matches
  // catalog models whose names include the brand (e.g. "Channel Islands (AMK) Keels…").
  const residualAfterBrand = brand
    ? stripMarketplaceSearchNoiseWords(
        residualMarketplaceQueryAfterBrand(withoutLength, brand.name),
      )
    : ""

  let model: MarketplaceParsedModel | null = null
  let modelIds: string[] = []

  if (brand) {
    if (residualAfterBrand.length >= 2) {
      const modelsForBrand = await resolveModelsForParse(
        supabase,
        brand,
        residualAfterBrand,
      )
      model = modelsForBrand.model
      modelIds = modelsForBrand.modelIds
    }
  } else {
    // Model-only queries (no brand resolved yet) — e.g. "dumpster diver".
    const modelFirst = await resolveModelsForParse(supabase, null, cleaned)
    model = modelFirst.model
    modelIds = modelFirst.modelIds
  }

  // If model implies a brand and we didn't resolve one, adopt the model's brand.
  let resolvedBrand = brand
  if (!resolvedBrand && model) {
    const { data } = await supabase
      .from("brands")
      .select("id, name, slug, logo_url")
      .eq("id", model.brandId)
      .maybeSingle()
    if (data?.id && data.slug) {
      resolvedBrand = {
        id: data.id,
        name: data.name,
        slug: data.slug,
      }
    }
  }

  let residual = withoutLength
  if (resolvedBrand) {
    residual = residualMarketplaceQueryAfterBrand(residual, resolvedBrand.name)
  }
  if (model) {
    residual = stripPhraseFromQuery(residual, model.name)
    // Strip the typed model phrase even when catalog name is longer ("Dumpster Diver 2").
    residual = stripPhraseFromQuery(residual, residualAfterBrand || cleaned)
  }
  const synonymMapsToBrand = Boolean(
    resolvedBrand &&
      expansions.some((e) => e.toLowerCase() === resolvedBrand.name.toLowerCase()),
  )

  // Drop short leftover tokens that only identified the brand via synonym (e.g. "ci").
  if (synonymMapsToBrand && residual) {
    const modelTokenSet = new Set(
      (model?.name.toLowerCase().match(/[\w']+/g) ?? []).filter((t) => t.length >= 2),
    )
    residual = residual
      .split(/\s+/)
      .filter((token) => {
        const core = token.toLowerCase().replace(/^['']+|['']+$/g, "")
        if (!core) return false
        if (modelTokenSet.has(core)) return true
        return core.length > 3
      })
      .join(" ")
  }
  residual = stripMarketplaceSearchNoiseWords(residual)

  // After brand/model/length/noise strip (incl. section words like "fins"), nothing left ⇒ brand-only.
  const isBrandOnly = Boolean(
    resolvedBrand &&
      !model &&
      modelIds.length === 0 &&
      lengthInches == null &&
      (residual.length === 0 ||
        isBrandOnlyMarketplaceSuggestQuery(withoutLength, resolvedBrand.name) ||
        (synonymMapsToBrand && residual.length === 0)),
  )

  // Keyword text is what the shopper typed, never a longer catalog variant.
  // Falling back to model.name turned "john john florence" into
  // "John John Florence Vapor Core Scimitar (L)" and ES dropped Techflex.
  const textQuery = residual || residualAfterBrand || cleaned || raw

  return {
    raw,
    cleaned,
    brand: resolvedBrand,
    model,
    modelIds,
    lengthInches,
    lengthToken,
    residualText: residual,
    textQuery,
    isBrandOnly,
    sectionIntent,
    expansions,
  }
}
