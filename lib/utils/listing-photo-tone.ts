/**
 * Listing photo tone. Values are stops from -100 to 100.
 * Zero is the unedited photo. Highlights and shadows weight the bright and
 * dark ends so a small move does not wash the whole frame.
 */

export const LISTING_PHOTO_TONE_MIN = -100
export const LISTING_PHOTO_TONE_MAX = 100

export const LISTING_PHOTO_TONE_IDENTITY = {
  brightness: 0,
  highlights: 0,
  shadows: 0,
  contrast: 0,
} as const

export type ListingPhotoTone = {
  brightness: number
  highlights: number
  shadows: number
  contrast: number
}

export type ListingPhotoToneSavedImage = {
  id: string
  url: string
  thumbnailUrl: string | null
  sourceUrl: string | null
  brightness: number
  highlights: number
  shadows: number
  contrast: number
}

export type ListingPhotoToneImageRow = {
  tone_brightness?: unknown
  tone_highlights?: unknown
  tone_shadows?: unknown
  tone_contrast?: unknown
  tone_source_url?: unknown
}

const BRIGHTNESS_GAIN = 0.55
const CONTRAST_GAIN = 0.65
const HIGHLIGHT_LIFT = 0.4
const SHADOW_LIFT = 0.45
const HIGHLIGHT_MASK_START = 0.45
const SHADOW_MASK_START = 0.55

function clamp01(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function clampStop(value: number): number {
  if (!Number.isFinite(value)) return 0
  const rounded = Math.round(value)
  if (rounded < LISTING_PHOTO_TONE_MIN) return LISTING_PHOTO_TONE_MIN
  if (rounded > LISTING_PHOTO_TONE_MAX) return LISTING_PHOTO_TONE_MAX
  return rounded
}

function readStop(value: unknown): number {
  if (typeof value === "number") return clampStop(value)
  if (typeof value === "string" && value.trim()) return clampStop(Number(value))
  return 0
}

/** Smoothstep. `edge0` may be greater than `edge1` (shadow mask). */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0
  if (span === 0) return x >= edge1 ? 1 : 0
  const t = clamp01((x - edge0) / span)
  return t * t * (3 - 2 * t)
}

export function clampListingPhotoTone(
  tone: Partial<ListingPhotoTone> | null | undefined,
): ListingPhotoTone {
  return {
    brightness: clampStop(tone?.brightness ?? 0),
    highlights: clampStop(tone?.highlights ?? 0),
    shadows: clampStop(tone?.shadows ?? 0),
    contrast: clampStop(tone?.contrast ?? 0),
  }
}

export function isListingPhotoToneIdentity(
  tone: Partial<ListingPhotoTone> | null | undefined,
): boolean {
  const next = clampListingPhotoTone(tone)
  return (
    next.brightness === 0 &&
    next.highlights === 0 &&
    next.shadows === 0 &&
    next.contrast === 0
  )
}

export function listingPhotoTonesEqual(
  a: Partial<ListingPhotoTone> | null | undefined,
  b: Partial<ListingPhotoTone> | null | undefined,
): boolean {
  const left = clampListingPhotoTone(a)
  const right = clampListingPhotoTone(b)
  return (
    left.brightness === right.brightness &&
    left.highlights === right.highlights &&
    left.shadows === right.shadows &&
    left.contrast === right.contrast
  )
}

export function listingPhotoToneFromImageRow(
  row: ListingPhotoToneImageRow | null | undefined,
): ListingPhotoTone {
  if (!row) return { ...LISTING_PHOTO_TONE_IDENTITY }
  return clampListingPhotoTone({
    brightness: readStop(row.tone_brightness),
    highlights: readStop(row.tone_highlights),
    shadows: readStop(row.tone_shadows),
    contrast: readStop(row.tone_contrast),
  })
}

/** Unedited full object. Falls back to the current listing photo URL. */
export function listingPhotoToneSourceUrl(
  row: { url?: string | null; tone_source_url?: unknown } | null | undefined,
): string {
  const source = typeof row?.tone_source_url === "string" ? row.tone_source_url.trim() : ""
  if (source) return source
  return row?.url?.trim() ?? ""
}

function channelByte(value: number): number {
  return Math.round(clamp01(value) * 255)
}

/**
 * Apply tone to one sRGB pixel. Identity returns the input bytes unchanged.
 * Brightness and contrast run first. Highlights and shadows then move luminance
 * at the bright and dark ends and scale RGB so the hue stays put.
 */
export function listingPhotoToneRgb(
  r: number,
  g: number,
  b: number,
  tone: ListingPhotoTone,
): readonly [number, number, number] {
  if (isListingPhotoToneIdentity(tone)) {
    return [r, g, b]
  }

  let red = r / 255
  let green = g / 255
  let blue = b / 255

  const gain = 1 + (tone.brightness / 100) * BRIGHTNESS_GAIN
  red *= gain
  green *= gain
  blue *= gain

  const contrast = 1 + (tone.contrast / 100) * CONTRAST_GAIN
  red = (red - 0.5) * contrast + 0.5
  green = (green - 0.5) * contrast + 0.5
  blue = (blue - 0.5) * contrast + 0.5

  const lum = clamp01(0.2126 * red + 0.7152 * green + 0.0722 * blue)
  const highlightMask = smoothstep(HIGHLIGHT_MASK_START, 1, lum)
  const shadowMask = smoothstep(SHADOW_MASK_START, 0, lum)
  const lift =
    (tone.highlights / 100) * HIGHLIGHT_LIFT * highlightMask +
    (tone.shadows / 100) * SHADOW_LIFT * shadowMask
  const target = clamp01(lum + lift)

  if (lum > 0.001) {
    const scale = target / lum
    red *= scale
    green *= scale
    blue *= scale
  } else {
    red = target
    green = target
    blue = target
  }

  return [channelByte(red), channelByte(green), channelByte(blue)]
}

/** In-place tone for RGB or RGBA buffers. Skips the alpha byte. */
export function applyListingPhotoToneToPixels(
  pixels: Uint8Array | Uint8ClampedArray,
  channels: 3 | 4,
  tone: ListingPhotoTone,
): void {
  if (isListingPhotoToneIdentity(tone)) return
  const next = clampListingPhotoTone(tone)
  for (let i = 0; i < pixels.length; i += channels) {
    const [r, g, b] = listingPhotoToneRgb(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0, next)
    pixels[i] = r
    pixels[i + 1] = g
    pixels[i + 2] = b
  }
}

/**
 * Baked files to delete after a tone save. The unedited source and its
 * siblings stay. The first bake (`previous` still is the source) deletes nothing.
 */
export function listingPhotoToneObjectsToRemove(input: {
  previousFullUrl: string | null | undefined
  previousThumbUrl: string | null | undefined
  sourceFullUrl: string | null | undefined
}): string[] {
  const previous = input.previousFullUrl?.trim() ?? ""
  const source = input.sourceFullUrl?.trim() ?? ""
  if (!previous || previous === source) return []

  const urls = [previous]
  if (previous.includes("-full.")) {
    urls.push(
      previous.replace("-full.", "-thumb."),
      previous.replace("-full.", "-card2."),
      previous.replace("-full.", "-film2."),
    )
  }
  const thumb = input.previousThumbUrl?.trim() ?? ""
  if (thumb && thumb !== source) urls.push(thumb)

  return [...new Set(urls)]
}

/** Storage keys for a baked listing photo. Names match the `/media/listings` proxy. */
export function listingPhotoToneStoragePaths(
  ownerId: string,
  stamp: string,
  imageId: string,
): { full: string; thumb: string; card: string; film: string } {
  const base = `${ownerId}/${stamp}-${imageId}`
  return {
    full: `${base}-full.webp`,
    thumb: `${base}-thumb.webp`,
    card: `${base}-card2.webp`,
    film: `${base}-film2.webp`,
  }
}

/** Columns written for a tone. Identity clears the stops. */
export function listingPhotoToneColumnValues(tone: ListingPhotoTone): {
  tone_brightness: number | null
  tone_highlights: number | null
  tone_shadows: number | null
  tone_contrast: number | null
} {
  const next = clampListingPhotoTone(tone)
  return {
    tone_brightness: next.brightness === 0 ? null : next.brightness,
    tone_highlights: next.highlights === 0 ? null : next.highlights,
    tone_shadows: next.shadows === 0 ? null : next.shadows,
    tone_contrast: next.contrast === 0 ? null : next.contrast,
  }
}
