/** Stored in `listings.fins_setup` as comma-separated canonical slugs (search/filter metadata). */

export const FIN_SETUP_TAG_SLUGS = [
  "single",
  "twin_only",
  "twin",
  "thruster",
  "quad",
  "five",
  "other",
] as const

export type FinSetupTagSlug = (typeof FIN_SETUP_TAG_SLUGS)[number]

const SLUG_SET = new Set<string>(FIN_SETUP_TAG_SLUGS)

export const FIN_SETUP_TAG_OPTIONS: readonly { value: FinSetupTagSlug; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "twin_only", label: "Twin" },
  { value: "twin", label: "Twin (2+1)" },
  { value: "thruster", label: "Thruster" },
  { value: "quad", label: "Quad" },
  { value: "five", label: "5-fin" },
  { value: "other", label: "Other" },
]

export function isFinSetupTagSlug(s: string): s is FinSetupTagSlug {
  return SLUG_SET.has(s)
}

/** Parse DB or legacy single-slug value into ordered unique allowed slugs. */
export function parseFinsSetupFromStorage(raw: string | null | undefined): FinSetupTagSlug[] {
  if (raw == null || typeof raw !== "string") return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  const seen = new Set<FinSetupTagSlug>()
  const out: FinSetupTagSlug[] = []
  for (const part of trimmed.split(",")) {
    const slug = part.trim().toLowerCase()
    if (!isFinSetupTagSlug(slug) || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

/** Persist as comma-separated slugs, or null when empty. */
export function serializeFinsSetupTags(tags: readonly string[]): string | null {
  const ordered = [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(isFinSetupTagSlug))].sort()
  return ordered.length ? ordered.join(",") : null
}

/** Draft restore: accept legacy string, unknown[], or missing. */
export function normalizeBoardFinsForm(value: unknown): FinSetupTagSlug[] {
  if (Array.isArray(value)) {
    return parseFinsSetupFromStorage(value.filter((x) => typeof x === "string").join(","))
  }
  if (typeof value === "string") return parseFinsSetupFromStorage(value)
  return []
}

/** Single-select form value from draft/legacy (first allowed slug if several were stored). */
export function singleFinSetupSlugForForm(value: unknown): string {
  return normalizeBoardFinsForm(value)[0] ?? ""
}

export const FIN_SETUP_LABELS: Record<FinSetupTagSlug, string> = Object.fromEntries(
  FIN_SETUP_TAG_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FinSetupTagSlug, string>
