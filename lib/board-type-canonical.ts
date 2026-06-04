function normalizeListingsBoardTypeRaw(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
}

/**
 * Canonical `listings.board_type` slug for analytics and URL alignment (legacy
 * alias strings fold into the primary slug). Empty when missing.
 */
export function canonicalListingsBoardTypeKey(boardType: string | null | undefined): string {
  const normalized = normalizeListingsBoardTypeRaw(boardType ?? "")
  if (!normalized || normalized === "all") return ""
  if (normalized === "mid-length" || normalized === "funboard") return "hybrid"
  if (normalized === "step-up" || normalized === "gun") return "step-up-gun"
  return normalized
}

/**
 * DB values that match `listings.board_type` when filtering by a canonical slug.
 */
export function listingBoardTypeDbValuesForFilter(boardType: string | null | undefined): string[] {
  const canonical = canonicalListingsBoardTypeKey(boardType)
  if (!canonical) return []

  const aliasGroups: Record<string, readonly string[]> = {
    hybrid: ["hybrid", "funboard", "mid-length"],
    "step-up-gun": ["step-up-gun", "step-up", "gun"],
  }
  const group = aliasGroups[canonical]
  return group ? [...group] : [canonical]
}
