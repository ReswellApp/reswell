import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

const LIST_KEYS = [
  "conditions",
  "style",
  "fin",
  "finSystem",
  "construction",
  "length",
  "volume",
  "sizes",
  "kind",
] as const satisfies readonly (keyof BoardSavedSearchCriteria)[]

const STRING_KEYS = [
  "section",
  "alertKind",
  "source",
  "brand",
  "brandId",
  "brandSlug",
  "model",
  "brandModelId",
  "modelSlug",
  "dimensions",
  "dimLength",
  "dimWidth",
  "dimThickness",
  "dimVolume",
  "type",
  "condition",
  "sort",
] as const satisfies readonly (keyof BoardSavedSearchCriteria)[]

function normString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === "all") return undefined
  return trimmed
}

function normQuery(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim().replace(/\s+/g, " ").toLowerCase()
  return trimmed || undefined
}

function normList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .sort()
  return items.length > 0 ? items : undefined
}

function normNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return value
}

/** Stable comparison of two saved-search snapshots, ignoring empty and legacy geo fields. */
export function boardSavedCriteriaEquals(
  a: BoardSavedSearchCriteria,
  b: BoardSavedSearchCriteria,
): boolean {
  if (normQuery(a.q) !== normQuery(b.q)) return false
  if ((a.anySection === true) !== (b.anySection === true)) return false
  if ((a.shipping === true) !== (b.shipping === true)) return false
  if (normNumber(a.minPrice) !== normNumber(b.minPrice)) return false
  if (normNumber(a.maxPrice) !== normNumber(b.maxPrice)) return false
  if (normNumber(a.minYear) !== normNumber(b.minYear)) return false
  if (normNumber(a.maxYear) !== normNumber(b.maxYear)) return false

  for (const key of STRING_KEYS) {
    if (normString(a[key]) !== normString(b[key])) return false
  }
  for (const key of LIST_KEYS) {
    const left = normList(a[key])
    const right = normList(b[key])
    if ((left?.join("\0") ?? "") !== (right?.join("\0") ?? "")) return false
  }
  return true
}

export function savedSearchMatchesCriteria(
  saved: readonly { criteria: BoardSavedSearchCriteria }[],
  criteria: BoardSavedSearchCriteria,
): boolean {
  return saved.some((row) => boardSavedCriteriaEquals(row.criteria, criteria))
}

/** Id of the saved row that matches `criteria`, so the same search can be removed. */
export function matchingSavedSearchId(
  saved: readonly { id: string; criteria: BoardSavedSearchCriteria }[],
  criteria: BoardSavedSearchCriteria,
): string | null {
  return saved.find((row) => boardSavedCriteriaEquals(row.criteria, criteria))?.id ?? null
}
