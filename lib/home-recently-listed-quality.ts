/**
 * Homepage “Recently listed” quality bar: Very Good or better, long descriptive titles.
 * Includes legacy `new` / `like_new` so older rows still qualify.
 */
export const HOME_RECENTLY_LISTED_FEATURE_CONDITIONS = [
  "brand_new",
  "excellent",
  "very_good",
  "new",
  "like_new",
] as const

const HOME_RECENTLY_LISTED_FEATURE_CONDITION_SET = new Set<string>(
  HOME_RECENTLY_LISTED_FEATURE_CONDITIONS,
)

/** Long enough to read as brand + model (or length + brand + model), not a stub. */
export const HOME_RECENTLY_LISTED_MIN_TITLE_CHARS = 28
/** At least three letter-bearing tokens so concatenated / one-word titles drop out. */
export const HOME_RECENTLY_LISTED_MIN_TITLE_WORDS = 3

const GENERIC_HOME_TITLE_RE =
  /^(used\s+)?(surfboard|board|fins?|fin set|shortboard|longboard)s?(\s+for\s+sale)?$/i

export function isHomeRecentlyListedFeatureCondition(condition: string | null | undefined): boolean {
  const raw = typeof condition === "string" ? condition.trim() : ""
  return raw.length > 0 && HOME_RECENTLY_LISTED_FEATURE_CONDITION_SET.has(raw)
}

export function isHomeRecentlyListedFeatureTitle(title: string | null | undefined): boolean {
  const trimmed = typeof title === "string" ? title.trim() : ""
  if (trimmed.length < HOME_RECENTLY_LISTED_MIN_TITLE_CHARS) return false
  if (GENERIC_HOME_TITLE_RE.test(trimmed)) return false

  const words = trimmed.split(/\s+/).filter((word) => /[a-zA-Z]/.test(word))
  return words.length >= HOME_RECENTLY_LISTED_MIN_TITLE_WORDS
}

export function isHomeRecentlyListedFeatureListing(listing: {
  title?: string | null
  condition?: string | null
}): boolean {
  return (
    isHomeRecentlyListedFeatureCondition(listing.condition) &&
    isHomeRecentlyListedFeatureTitle(listing.title)
  )
}

export function filterHomeRecentlyListedFeatureListings<T extends { title?: string | null; condition?: string | null }>(
  listings: T[],
): T[] {
  return listings.filter(isHomeRecentlyListedFeatureListing)
}
