import type { BoardModel, BoardModelDetail, BoardModelGalleryImage } from "@/lib/index-directory/types"

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function isCompositePath(p: string): boolean {
  return /top-and-bottom|deck-and-bottom|top_and_bottom|deck_and_bottom/i.test(p)
}

/** True if URL path suggests a bottom / underside product shot (not a composite). */
function isBottomPath(pathname: string): boolean {
  const p = pathname.toLowerCase()
  if (isCompositePath(p)) return false
  return (
    /[-_/]bottom\.(jpg|jpeg|png|webp)(\?|$)/i.test(pathname) ||
    /[-_/]bottom[-_]/i.test(pathname) ||
    /[-_/]btm\.(jpg|jpeg|png|webp)(\?|$)/i.test(pathname)
  )
}

/** True if URL path suggests a deck / top product shot (not a composite). */
function isDeckPath(pathname: string): boolean {
  const p = pathname.toLowerCase()
  if (isCompositePath(p)) return false
  if (isBottomPath(pathname)) return false
  return (
    /[-_]deck\.(jpg|jpeg|png|webp)(\?|$)/i.test(pathname) ||
    /[-_/]deck[-_]/i.test(pathname) ||
    /[-_]top\.(jpg|jpeg|png|webp)(\?|$)/i.test(pathname) ||
    /[-_/]top[-_]/i.test(pathname)
  )
}

type Side = "deck" | "bottom"

function classifyUrl(url: string): Side | null {
  const path = pathnameOf(url)
  if (isBottomPath(path)) return "bottom"
  if (isDeckPath(path)) return "deck"
  return null
}

/** Strip trailing side token so e.g. mod-quad-top and mod-quad-bottom share a stem. */
function pairingStem(url: string): string | null {
  const path = pathnameOf(url)
  const base = path.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, "")
  const stripped = base.replace(/[-_](deck|top|bottom|btm)$/i, "")
  return stripped.length > 0 ? stripped.toLowerCase() : null
}

function captionSide(caption: string): Side | null {
  const c = caption.trim().toLowerCase()
  if (/^deck$|^deck view$|^top$|^top view$|^deck\s*\(top\)$/.test(c)) return "deck"
  if (/^bottom$|^bottom view$|^underside$|^rail bottom$/.test(c)) return "bottom"
  return null
}

/**
 * Picks deck + bottom hero URLs the same way Channel Islands encodes them:
 * explicit {@link BoardModelDetail.deckImageUrl} / {@link BoardModelDetail.bottomImageUrl},
 * gallery captions "Deck" / "Bottom" (or Top / Bottom view),
 * or recognizable filename patterns (…-top.… + …-bottom.…, …_Deck.…, etc.).
 */
export function extractDeckBottomPair(
  gallery: BoardModelGalleryImage[],
  model: BoardModel,
  detail: BoardModelDetail | null,
): { deck: string; bottom: string } | null {
  const explicitDeck = detail?.deckImageUrl?.trim()
  const explicitBottom = detail?.bottomImageUrl?.trim()
  if (explicitDeck && explicitBottom && explicitDeck !== explicitBottom) {
    return { deck: explicitDeck, bottom: explicitBottom }
  }

  let deck: string | undefined
  let bottom: string | undefined

  for (const { url, caption } of gallery) {
    const side = captionSide(caption)
    if (side === "deck" && !deck) deck = url
    if (side === "bottom" && !bottom) bottom = url
  }

  if (deck && bottom && deck !== bottom) return { deck, bottom }

  // Stem-based pairing (Lost: *-top.jpg + *-bottom.jpg, CI-style filenames, etc.)
  const candidates = new Set<string>()
  for (const { url } of gallery) {
    if (url) candidates.add(url)
  }
  if (model.imageUrl) candidates.add(model.imageUrl)

  const byStem = new Map<string, { deck?: string; bottom?: string }>()
  for (const url of candidates) {
    const side = classifyUrl(url)
    if (!side) continue
    const stem = pairingStem(url)
    if (!stem) continue
    const row = byStem.get(stem) ?? {}
    if (side === "deck" && !row.deck) row.deck = url
    if (side === "bottom" && !row.bottom) row.bottom = url
    byStem.set(stem, row)
  }

  for (const { deck: d, bottom: b } of byStem.values()) {
    if (d && b && d !== b) return { deck: d, bottom: b }
  }

  // Global fallback: exactly one deck-like and one bottom-like URL in the set
  const deckUrls: string[] = []
  const bottomUrls: string[] = []
  for (const url of candidates) {
    const side = classifyUrl(url)
    if (side === "deck") deckUrls.push(url)
    if (side === "bottom") bottomUrls.push(url)
  }
  if (deckUrls.length === 1 && bottomUrls.length === 1 && deckUrls[0] !== bottomUrls[0]) {
    return { deck: deckUrls[0], bottom: bottomUrls[0] }
  }

  return null
}
