/** Normalize CMS `about_paragraphs` for public brand pages. */
export function brandAboutParagraphs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean)
}

export function brandPublicWebsiteHref(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.toString()
  } catch {
    return null
  }
}

/** Long-form body copy: CMS paragraphs, or short description when no paragraphs exist. */
export function brandStoryParagraphs(input: {
  short_description: string | null
  about_paragraphs: string[]
}): string[] {
  if (input.about_paragraphs.length > 0) return input.about_paragraphs
  const short = input.short_description?.trim()
  return short ? [short] : []
}

/** Lead line under the title — only when long-form paragraphs are shown separately. */
export function brandStoryLead(input: {
  short_description: string | null
  about_paragraphs: string[]
}): string | null {
  const short = input.short_description?.trim()
  if (!short) return null
  if (input.about_paragraphs.length === 0) return null
  return short
}
