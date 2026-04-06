/**
 * Generate a URL-friendly slug from a listing title.
 * Truncated to stay short; listing titles are capped in the sell flow (`LISTING_TITLE_MAX_LENGTH` in `sell-form-validation`).
 *
 * Examples:
 *   "Channel Islands Trip Plan Hull 7'5" → "channel-islands-trip-plan-hull-7-5"
 *   "O'Neill Psycho Tech 4/3mm Wetsuit" → "oneill-psycho-tech-4-3mm-wetsuit"
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['ʼ'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUUID(value: string): boolean {
  return UUID_RE.test(value)
}
