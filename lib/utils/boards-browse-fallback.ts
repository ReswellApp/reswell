export const NEARBY_BROWSE_FALLBACK_RADIUS_MI = 100

export type NearbyBrowseFallbackCandidate = {
  id: string
  distanceMi: number
}

export type NearbyBrowseFallbackKind =
  | "near-keyword"
  | "near-relaxed"
  | "wide-keyword"
  | "wide-relaxed"

export function resolveNearbyBrowseFallbackCandidates(
  rows: NearbyBrowseFallbackCandidate[],
  keywordMatchedIds: ReadonlySet<string>,
  hasKeyword: boolean,
): {
  ids: string[]
  kind: NearbyBrowseFallbackKind | null
} {
  const ordered = [...rows].sort((a, b) => a.distanceMi - b.distanceMi)
  const keywordRows = hasKeyword
    ? ordered.filter((row) => keywordMatchedIds.has(row.id))
    : ordered
  const candidates: Array<{
    rows: NearbyBrowseFallbackCandidate[]
    kind: NearbyBrowseFallbackKind
  }> = [
    {
      rows: keywordRows.filter((row) => row.distanceMi <= NEARBY_BROWSE_FALLBACK_RADIUS_MI),
      kind: "near-keyword",
    },
    {
      rows: ordered.filter((row) => row.distanceMi <= NEARBY_BROWSE_FALLBACK_RADIUS_MI),
      kind: hasKeyword ? "near-relaxed" : "near-keyword",
    },
    { rows: keywordRows, kind: "wide-keyword" },
    { rows: ordered, kind: hasKeyword ? "wide-relaxed" : "wide-keyword" },
  ]
  const selected = candidates.find((candidate) => candidate.rows.length > 0)
  if (!selected) return { ids: [], kind: null }
  return {
    ids: selected.rows.map((row) => row.id),
    kind: selected.kind,
  }
}
