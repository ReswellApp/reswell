const URL_PATTERN =
  /https?:\/\/[^\s<>"{}|\\^`[\]]+[^\s<>"{}|\\^`[\].,;:!?)]/gi

/** Count distinct http(s) URLs in plain text. */
export function countUrlsInText(text: string | null | undefined): number {
  if (!text?.trim()) return 0
  const matches = text.match(URL_PATTERN)
  if (!matches) return 0
  return new Set(matches.map((m) => m.toLowerCase())).size
}
