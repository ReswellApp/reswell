export const MAX_SURFER_QUIVER_ITEMS = 12
const MAX_IMAGE_URL_LEN = 2048
const MAX_QUIVER_TITLE_LEN = 200
const MAX_QUIVER_DESCRIPTION_LEN = 2000

export type SurferQuiverItem = {
  image_url: string
  title: string | null
  description: string | null
}

function parseOptionalBlurb(
  input: unknown,
  maxLen: number,
  fieldLabel: string,
): string | null | { error: string } {
  if (input === undefined || input === null) return null
  if (typeof input !== "string") {
    return { error: `${fieldLabel} must be a string` }
  }
  const t = input.trim()
  if (!t) return null
  if (t.length > maxLen) {
    return { error: `${fieldLabel} is too long` }
  }
  return t
}

/**
 * Validates admin + JSON bodies. Accepts `{ image_url, title?, description? }[]` or legacy string URLs.
 */
export function parseSurferQuiverItems(input: unknown): SurferQuiverItem[] | { error: string } {
  if (input === undefined || input === null) return []
  if (!Array.isArray(input)) {
    return { error: "quiver_items must be an array" }
  }
  const out: SurferQuiverItem[] = []
  for (const item of input) {
    if (typeof item === "string") {
      const u = item.trim()
      if (!u) continue
      if (u.length > MAX_IMAGE_URL_LEN) {
        return { error: "A quiver image URL is too long" }
      }
      out.push({ image_url: u, title: null, description: null })
      if (out.length > MAX_SURFER_QUIVER_ITEMS) {
        return { error: `At most ${MAX_SURFER_QUIVER_ITEMS} quiver items allowed` }
      }
      continue
    }
    if (!item || typeof item !== "object") {
      return { error: "Each quiver item must be an object with image_url or a URL string" }
    }
    const o = item as Record<string, unknown>
    if (typeof o.image_url !== "string") {
      return { error: "Each quiver item must have an image_url string" }
    }
    const url = o.image_url.trim()
    if (!url) continue
    if (url.length > MAX_IMAGE_URL_LEN) {
      return { error: "A quiver image URL is too long" }
    }

    const title = parseOptionalBlurb(o.title, MAX_QUIVER_TITLE_LEN, "Quiver title")
    if (title !== null && typeof title === "object") return title
    const description = parseOptionalBlurb(
      o.description,
      MAX_QUIVER_DESCRIPTION_LEN,
      "Quiver description",
    )
    if (description !== null && typeof description === "object") return description

    out.push({ image_url: url, title, description })
    if (out.length > MAX_SURFER_QUIVER_ITEMS) {
      return { error: `At most ${MAX_SURFER_QUIVER_ITEMS} quiver items allowed` }
    }
  }
  return out
}

/** Coerces DB / loose JSON into a consistent shape (drops invalid rows). */
export function normalizeSurferQuiverItemsFromDb(raw: unknown): SurferQuiverItem[] {
  if (!raw) return []
  if (!Array.isArray(raw)) return []
  const out: SurferQuiverItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const url = typeof o.image_url === "string" ? o.image_url.trim() : ""
    if (!url) continue
    let title: string | null = null
    if (typeof o.title === "string") {
      const t = o.title.trim()
      title = t || null
    }
    let description: string | null = null
    if (typeof o.description === "string") {
      const t = o.description.trim()
      description = t || null
    }
    out.push({ image_url: url, title, description })
    if (out.length >= MAX_SURFER_QUIVER_ITEMS) break
  }
  return out
}
