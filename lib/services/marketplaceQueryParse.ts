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
import {
  isBrandOnlyMarketplaceSuggestQuery,
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
  /** Best catalog model match (longest / exact). */
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
  expansions: string[]
}

const LENGTH_TOKEN_RE =
  /(?:^|\s)(\d{1,2})['′]\s*(\d{1,2}(?:\s*\d+\/\d+)?)?(?:"|\u2033)?(?=\s|$)/gu
/** `5 10`, `5.10`, `510` (feet+inches) when users omit the apostrophe. */
const LENGTH_LOOSE_RE =
  /(?:^|\s)(\d{1,2})(?:\s+|\.)(\d{1,2})(?=\s|$)/g

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

  return { lengthInches: null, lengthToken: null, withoutLength: raw.trim() }
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

function pickBestModel(
  q: string,
  candidates: MarketplaceParsedModel[],
): MarketplaceParsedModel | null {
  if (candidates.length === 0) return null
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
  // Prefer longer catalog names so "Dumpster Diver 2" wins over a short partial when both match.
  return [...candidates].sort((a, b) => b.name.length - a.name.length)[0] ?? null
}

async function resolveModelsForParse(
  supabase: SupabaseClient,
  brand: MarketplaceParsedBrand | null,
  modelQuery: string,
): Promise<{ model: MarketplaceParsedModel | null; modelIds: string[] }> {
  const q = modelQuery.trim()
  if (q.length < 2) return { model: null, modelIds: [] }

  const lower = q.toLowerCase()

  if (brand) {
    const rows = await searchBrandModelsForBrandId(supabase, brand.id, q, 40)
    const candidates: MarketplaceParsedModel[] = rows
      .filter(
        (r) =>
          r.name.toLowerCase() === lower ||
          r.name.toLowerCase().includes(lower) ||
          lower.includes(r.name.toLowerCase()),
      )
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
    .filter(
      (r) =>
        r.name.toLowerCase() === lower ||
        r.name.toLowerCase().includes(lower) ||
        lower.includes(r.name.toLowerCase()),
    )
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
      expansions,
    }
  }

  const { lengthInches, lengthToken, withoutLength } = extractLengthFromQuery(raw)
  const cleaned = stripMarketplaceSearchNoiseWords(withoutLength) || withoutLength.trim()

  // Resolve model first for model-only queries so we don't fuzzy-match a brand incorrectly.
  const modelFirst = await resolveModelsForParse(supabase, null, cleaned)
  const brand = await resolveBrandForParse(
    supabase,
    raw,
    withoutLength,
    expansions,
    options?.brandHint,
  )

  const modelSearchText = brand
    ? residualMarketplaceQueryAfterBrand(withoutLength, brand.name) || cleaned
    : cleaned

  const modelsForBrand = brand
    ? await resolveModelsForParse(supabase, brand, modelSearchText)
    : modelFirst

  // Prefer brand-scoped models when we have a grounded brand; else model-first hits.
  const modelBundle =
    brand && modelsForBrand.modelIds.length > 0 ? modelsForBrand : modelFirst.modelIds.length > 0
      ? modelFirst
      : modelsForBrand
  const model = modelBundle.model
  const modelIds = modelBundle.modelIds

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
    residual = stripPhraseFromQuery(residual, modelSearchText)
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

  const isBrandOnly = Boolean(
    resolvedBrand &&
      !model &&
      modelIds.length === 0 &&
      lengthInches == null &&
      (isBrandOnlyMarketplaceSuggestQuery(withoutLength, resolvedBrand.name) ||
        (synonymMapsToBrand && residual.length === 0)),
  )

  // Always keep keyword text so listings missing brand_model_id still match on title/model.
  const textQuery = residual || model?.name || cleaned || raw

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
    expansions,
  }
}
