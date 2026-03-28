/**
 * Appends surfboard length to a listing title ("… - 5'6\"") when the user provided
 * length and the title does not already end with that value.
 */
export function listingTitleWithBoardLength(title: string, boardLength: string): string {
  const len = boardLength.trim()
  if (!len) return title.trim()
  const t = title.trim()
  if (!t) return len
  const tl = t.toLowerCase()
  const ll = len.toLowerCase()
  if (tl === ll || tl.endsWith(ll)) return t
  if (tl.endsWith(`- ${ll}`) || tl.endsWith(`– ${ll}`)) return t
  return `${t} - ${len}`
}
