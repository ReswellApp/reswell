/** Full URL or host/path; returns stored https URL or null. */
export function normalizeOptionalHttpUrl(input: unknown): string | null {
  if (input === undefined || input === null) return null
  if (typeof input !== "string") return null
  const t = input.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}
