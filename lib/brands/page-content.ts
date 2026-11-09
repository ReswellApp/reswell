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

/** Directory card copy — one or two short sentences, never a pasted bio. */
export const BRAND_DIRECTORY_BLURB_MAX = 160

export function brandDirectoryBlurb(
  raw: string | null | undefined,
  maxLen = BRAND_DIRECTORY_BLURB_MAX,
): string | null {
  let text = raw?.trim() ?? ""
  if (!text) return null

  const wrapped =
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("\u201c") && text.endsWith("\u201d"))
  if (wrapped) text = text.slice(1, -1).trim()
  if (!text) return null

  if (text.length > maxLen) {
    const sentence = text.match(/^(.+?[.!?])(?:\s|$)/)
    if (sentence?.[1] && sentence[1].length <= maxLen) {
      text = sentence[1]
    }
  }

  if (text.length <= maxLen) return text

  const cut = text.slice(0, maxLen - 1)
  const lastSpace = cut.lastIndexOf(" ")
  const clipped = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()
  return clipped ? `${clipped}…` : null
}
