/** Stored in `listings.tail_shape` as comma-separated canonical slugs (search/filter metadata). */

export const TAIL_SHAPE_TAG_SLUGS = [
  "round",
  "squash",
  "square",
  "pin",
  "swallow",
  "fish",
] as const

export type TailShapeTagSlug = (typeof TAIL_SHAPE_TAG_SLUGS)[number]

const SLUG_SET = new Set<string>(TAIL_SHAPE_TAG_SLUGS)

export const TAIL_SHAPE_TAG_OPTIONS: readonly { value: TailShapeTagSlug; label: string }[] = [
  { value: "round", label: "Round" },
  { value: "squash", label: "Squash" },
  { value: "square", label: "Square" },
  { value: "pin", label: "Pin" },
  { value: "swallow", label: "Swallow" },
  { value: "fish", label: "Fish" },
]

export function isTailShapeTagSlug(s: string): s is TailShapeTagSlug {
  return SLUG_SET.has(s)
}

export function parseTailShapeFromStorage(raw: string | null | undefined): TailShapeTagSlug[] {
  if (raw == null || typeof raw !== "string") return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  const seen = new Set<TailShapeTagSlug>()
  const out: TailShapeTagSlug[] = []
  for (const part of trimmed.split(",")) {
    const slug = part.trim().toLowerCase()
    if (!isTailShapeTagSlug(slug) || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

export function serializeTailShapeTags(tags: readonly string[]): string | null {
  const ordered = [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(isTailShapeTagSlug))].sort()
  return ordered.length ? ordered.join(",") : null
}

export function normalizeBoardTailForm(value: unknown): TailShapeTagSlug[] {
  if (Array.isArray(value)) {
    return parseTailShapeFromStorage(value.filter((x) => typeof x === "string").join(","))
  }
  if (typeof value === "string") return parseTailShapeFromStorage(value)
  return []
}

/** Single-select form value from draft/legacy (first allowed slug if several were stored). */
export function singleTailShapeSlugForForm(value: unknown): string {
  return normalizeBoardTailForm(value)[0] ?? ""
}

export const TAIL_SHAPE_LABELS: Record<TailShapeTagSlug, string> = Object.fromEntries(
  TAIL_SHAPE_TAG_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TailShapeTagSlug, string>
