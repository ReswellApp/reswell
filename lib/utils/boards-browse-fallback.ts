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

export async function executeNearbyBrowseFallback<T>(params: {
  selectIds: () => Promise<{
    ids: string[]
    totalPages: number
    kind: NearbyBrowseFallbackKind | null
  }>
  hydrate: (ids: string[]) => Promise<T[]>
}): Promise<{
  boards: T[]
  totalPages: number
  kind: NearbyBrowseFallbackKind | null
}> {
  const selected = await params.selectIds()
  return {
    boards: await params.hydrate(selected.ids),
    totalPages: selected.totalPages,
    kind: selected.kind,
  }
}

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
