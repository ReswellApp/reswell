/**
 * Pure, deterministic matching of a listing title against the brand/model catalog.
 *
 * Used by the daily backfill cron to attach a directory brand / model to active
 * surfboard and fin listings that are missing them. Precision is favoured over
 * recall: a candidate only matches when its (normalized) name appears as a
 * whole-word phrase inside the title, so generic token overlap ("the", "6", a
 * shared letter) can never mislabel a listing.
 */

export type BrandMatchRow = { id: string; name: string; slug: string | null }
export type ModelMatchRow = { id: string; brand_id: string; name: string }

/** Single-word brand/model labels shorter than this are too noisy to trust in a title scan. */
const MIN_BRAND_PHRASE_LEN = 3
const MIN_MODEL_PHRASE_LEN = 3

/**
 * Lowercase, strip diacritics, fold every non-alphanumeric run to a single space,
 * and pad with leading/trailing spaces so `includes(" phrase ")` matches on word
 * boundaries only. Returns "" when nothing meaningful remains.
 */
function normalizeForPhraseMatch(raw: string): string {
  const folded = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
  const collapsed = folded.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
  return collapsed ? ` ${collapsed} ` : ""
}

/** Normalized phrase (no padding) for a candidate label, e.g. from a name or hyphenated slug. */
function normalizedPhrase(raw: string | null | undefined): string {
  if (!raw) return ""
  return normalizeForPhraseMatch(raw).trim()
}

function phraseAppearsIn(paddedHaystack: string, phrase: string): boolean {
  if (!phrase || !paddedHaystack) return false
  return paddedHaystack.includes(` ${phrase} `)
}

/**
 * Pick the directory brand whose name (or slug) appears as a whole-word phrase in
 * the title. When several match, the most specific (longest) name wins so
 * "Channel Islands" beats a stray single-token brand.
 */
export function matchBrandFromTitle(
  title: string | null | undefined,
  brands: BrandMatchRow[],
): BrandMatchRow | null {
  const haystack = title ? normalizeForPhraseMatch(title) : ""
  if (!haystack) return null

  let best: BrandMatchRow | null = null
  let bestLen = 0

  for (const brand of brands) {
    const namePhrase = normalizedPhrase(brand.name)
    const slugPhrase = normalizedPhrase(brand.slug?.replace(/-/g, " "))

    const candidates = [namePhrase, slugPhrase].filter(
      (phrase) => phrase.length >= MIN_BRAND_PHRASE_LEN,
    )
    const matched = candidates.some((phrase) => phraseAppearsIn(haystack, phrase))
    if (!matched) continue

    // Specificity = how much of the title the brand name accounts for.
    const score = namePhrase.length || slugPhrase.length
    if (score > bestLen) {
      bestLen = score
      best = brand
    }
  }

  return best
}

/**
 * Pick the catalog model whose name appears as a whole-word phrase in the title.
 * Callers must pass only models that belong to the listing's (matched or existing)
 * brand, since `brand_models` are brand-scoped — that scoping is the key precision
 * guard for otherwise-generic model names ("fish", "twin").
 */
export function matchModelFromTitle(
  title: string | null | undefined,
  models: ModelMatchRow[],
): ModelMatchRow | null {
  const haystack = title ? normalizeForPhraseMatch(title) : ""
  if (!haystack) return null

  let best: ModelMatchRow | null = null
  let bestLen = 0

  for (const model of models) {
    const namePhrase = normalizedPhrase(model.name)
    if (namePhrase.length < MIN_MODEL_PHRASE_LEN) continue
    if (!phraseAppearsIn(haystack, namePhrase)) continue

    if (namePhrase.length > bestLen) {
      bestLen = namePhrase.length
      best = model
    }
  }

  return best
}
