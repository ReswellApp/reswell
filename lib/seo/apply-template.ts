/**
 * Render an SEO template string by substituting `{token}` placeholders with values.
 * Pure + shared by the server (page metadata) and client (admin sample preview).
 *
 * - Unknown or empty tokens are removed.
 * - Leftover separator debris (e.g. " ·  · ", trailing "—", double spaces) is tidied so a
 *   missing variable never leaves an ugly title like "Surfboard ·  · Reswell".
 */
export function applySeoTemplate(template: string, vars: Record<string, string | undefined>): string {
  if (!template) return ""

  let out = template.replace(/\{(\w+)\}/g, (_match, token: string) => {
    const value = vars[token]
    return value && value.trim() ? value.trim() : "\u0000" // sentinel = removed token
  })

  // Collapse separators left orphaned by removed tokens.
  out = out
    .replace(/\s*[·\-–—|]\s*\u0000/g, "") // " · {gone}" → ""
    .replace(/\u0000\s*[·\-–—|]\s*/g, "") // "{gone} · " → ""
    .replace(/\u0000/g, "") // bare removed token
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([·\-–—|])\s*\1\s*/g, " $1 ") // collapse doubled separators
    .replace(/^[\s·\-–—|]+/, "")
    .replace(/[\s·\-–—|]+$/, "")
    .trim()

  return out
}

/** True when a string contains at least one `{token}` placeholder. */
export function hasTemplateTokens(value: string | null | undefined): boolean {
  return !!value && /\{(\w+)\}/.test(value)
}
