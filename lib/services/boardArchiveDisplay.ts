/** Strip ilike wildcards and characters that would break a PostgREST `in` filter. */
export function sanitizeBoardArchiveQuery(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/[%_,.()]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
}

export function formatBoardArchiveVariantSummary(
  variant: {
    length_label?: string | null
    width_label?: string | null
    thickness_label?: string | null
    volume_label?: string | null
  } | null,
): string | null {
  if (!variant) return null
  const dims = [variant.length_label, variant.width_label, variant.thickness_label]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
  const volume = variant.volume_label?.trim() ?? ""
  if (dims.length === 0 && !volume) return null
  const mid = dims.join(" × ")
  return volume ? `${mid}${mid ? " — " : ""}${volume}` : mid
}
