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
  /** Untouched upload. Null when this photo has no current recipe. */
  sourceUrl: string | null
  brightness: number
  highlights: number
  shadows: number
  contrast: number
}

/** Sliders stored beside a listing photo. The upload itself is never rewritten. */
export type ListingPhotoToneRecipe = {
  sourceUrl: string
  sourceThumbnailUrl: string | null
  renditionUrl: string
  renditionThumbnailUrl: string | null
  tone: ListingPhotoTone
}

/**
 * What an edit should bake from. A recipe counts only while `listing_images.url`
 * is still the rendition it produced. A replaced photo is a new original.
 */
export type ListingPhotoToneEdit = {
  sourceUrl: string
  sourceThumbnailUrl: string | null
  tone: ListingPhotoTone
  renditionIsCurrent: boolean
  staleRenditionUrl: string | null
  staleRenditionThumbnailUrl: string | null
}

export type ListingPhotoToneSavePlan =
  | {
      action: "skip"
      url: string
      thumbnailUrl: string | null
      sourceUrl: string | null
      tone: ListingPhotoTone
    }
  | {
      action: "restore"
      sourceUrl: string
      sourceThumbnailUrl: string | null
      removeUrls: string[]
    }
  | {
      action: "bake"
      sourceUrl: string
      sourceThumbnailUrl: string | null
      tone: ListingPhotoTone
      removeUrls: string[]
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

export function listingPhotoToneFromStops(
  row:
    | {
        brightness?: unknown
        highlights?: unknown
        shadows?: unknown
        contrast?: unknown
      }
    | null
    | undefined,
): ListingPhotoTone {
  if (!row) return { ...LISTING_PHOTO_TONE_IDENTITY }
  return clampListingPhotoTone({
    brightness: readStop(row.brightness),
    highlights: readStop(row.highlights),
    shadows: readStop(row.shadows),
    contrast: readStop(row.contrast),
  })
}

function trimmedUrl(value: string | null | undefined): string {
  return value?.trim() ?? ""
}

function trimmedUrlOrNull(value: string | null | undefined): string | null {
  const next = trimmedUrl(value)
  return next || null
}

/** A recipe row with a real source and rendition. Incomplete rows are ignored. */
export function listingPhotoToneRecipeFromRow(row: {
  source_url?: unknown
  source_thumbnail_url?: unknown
  rendition_url?: unknown
  rendition_thumbnail_url?: unknown
  brightness?: unknown
  highlights?: unknown
  shadows?: unknown
  contrast?: unknown
} | null | undefined): ListingPhotoToneRecipe | null {
  const sourceUrl = typeof row?.source_url === "string" ? row.source_url.trim() : ""
  const renditionUrl = typeof row?.rendition_url === "string" ? row.rendition_url.trim() : ""
  if (!sourceUrl || !renditionUrl) return null
  const sourceThumbnailUrl =
    typeof row?.source_thumbnail_url === "string" ? trimmedUrlOrNull(row.source_thumbnail_url) : null
  const renditionThumbnailUrl =
    typeof row?.rendition_thumbnail_url === "string"
      ? trimmedUrlOrNull(row.rendition_thumbnail_url)
      : null
  return {
    sourceUrl,
    sourceThumbnailUrl,
    renditionUrl,
    renditionThumbnailUrl,
    tone: listingPhotoToneFromStops(row),
  }
}

export function resolveListingPhotoToneEdit(input: {
  publicUrl: string | null | undefined
  publicThumbnailUrl: string | null | undefined
  recipe: ListingPhotoToneRecipe | null | undefined
}): ListingPhotoToneEdit {
  const publicUrl = trimmedUrl(input.publicUrl)
  const publicThumbnailUrl = trimmedUrlOrNull(input.publicThumbnailUrl)
  const recipe = input.recipe ?? null
  const renditionUrl = trimmedUrl(recipe?.renditionUrl)
  const sourceUrl = trimmedUrl(recipe?.sourceUrl)
  const renditionIsCurrent = Boolean(recipe && renditionUrl && sourceUrl && renditionUrl === publicUrl)

  if (renditionIsCurrent && recipe) {
    return {
      sourceUrl,
      sourceThumbnailUrl: trimmedUrlOrNull(recipe.sourceThumbnailUrl),
      tone: clampListingPhotoTone(recipe.tone),
      renditionIsCurrent: true,
      staleRenditionUrl: null,
      staleRenditionThumbnailUrl: null,
    }
  }

  const stale = Boolean(recipe && renditionUrl && renditionUrl !== publicUrl)
  return {
    sourceUrl: publicUrl,
    sourceThumbnailUrl: publicThumbnailUrl,
    tone: { ...LISTING_PHOTO_TONE_IDENTITY },
    renditionIsCurrent: false,
    staleRenditionUrl: stale ? renditionUrl : null,
    staleRenditionThumbnailUrl: stale ? trimmedUrlOrNull(recipe?.renditionThumbnailUrl) : null,
  }
}

function renditionCopiesToRemove(input: {
  publicUrl: string
  publicThumbnailUrl: string | null
  edit: ListingPhotoToneEdit
  recipe: ListingPhotoToneRecipe | null
}): string[] {
  if (input.edit.renditionIsCurrent) {
    return listingPhotoToneObjectsToRemove({
      previousFullUrl: input.publicUrl,
      previousThumbUrl: input.publicThumbnailUrl,
      sourceFullUrl: input.edit.sourceUrl,
      keepUrls: [input.edit.sourceUrl, input.edit.sourceThumbnailUrl],
    })
  }
  if (!input.edit.staleRenditionUrl || !input.recipe) return []
  return listingPhotoToneObjectsToRemove({
    previousFullUrl: input.edit.staleRenditionUrl,
    previousThumbUrl: input.edit.staleRenditionThumbnailUrl,
    sourceFullUrl: input.recipe.sourceUrl,
    keepUrls: [
      input.publicUrl,
      input.publicThumbnailUrl,
      input.recipe.sourceUrl,
      input.recipe.sourceThumbnailUrl,
    ],
  })
}

/**
 * Skip when the stored recipe already matches. Restore when the sliders return
 * to zero on the current rendition. Bake from the untouched source otherwise.
 * A photo the seller replaced is a new original: identity does not point the
 * listing back at the older upload.
 */
export function planListingPhotoToneSave(input: {
  publicUrl: string | null | undefined
  publicThumbnailUrl: string | null | undefined
  requested: Partial<ListingPhotoTone> | null | undefined
  recipe: ListingPhotoToneRecipe | null | undefined
}): ListingPhotoToneSavePlan {
  const publicUrl = trimmedUrl(input.publicUrl)
  const publicThumbnailUrl = trimmedUrlOrNull(input.publicThumbnailUrl)
  const requested = clampListingPhotoTone(input.requested)
  const recipe = input.recipe ?? null
  const edit = resolveListingPhotoToneEdit({
    publicUrl,
    publicThumbnailUrl,
    recipe,
  })

  if (listingPhotoTonesEqual(requested, edit.tone)) {
    return {
      action: "skip",
      url: publicUrl,
      thumbnailUrl: publicThumbnailUrl,
      sourceUrl: edit.renditionIsCurrent ? edit.sourceUrl : null,
      tone: edit.tone,
    }
  }

  if (isListingPhotoToneIdentity(requested)) {
    return {
      action: "restore",
      sourceUrl: edit.sourceUrl,
      sourceThumbnailUrl: edit.sourceThumbnailUrl,
      removeUrls: listingPhotoToneObjectsToRemove({
        previousFullUrl: publicUrl,
        previousThumbUrl: publicThumbnailUrl,
        sourceFullUrl: edit.sourceUrl,
        keepUrls: [edit.sourceUrl, edit.sourceThumbnailUrl],
      }),
    }
  }

  return {
    action: "bake",
    sourceUrl: edit.sourceUrl,
    sourceThumbnailUrl: edit.sourceThumbnailUrl,
    tone: requested,
    removeUrls: renditionCopiesToRemove({
      publicUrl,
      publicThumbnailUrl,
      edit,
      recipe,
    }),
  }
}

/** Active recipes from `GET /api/listings/:id/photo-tone`. Drops incomplete rows. */
export function parseListingPhotoToneActiveRecipes(body: unknown): Array<{
  id: string
  sourceUrl: string
  tone: ListingPhotoTone
}> {
  if (!body || typeof body !== "object") return []
  const data = (body as { data?: unknown }).data
  if (!data || typeof data !== "object") return []
  const images = (data as { images?: unknown }).images
  if (!Array.isArray(images)) return []

  const recipes: Array<{ id: string; sourceUrl: string; tone: ListingPhotoTone }> = []
  for (const row of images) {
    if (!row || typeof row !== "object") continue
    const record = row as {
      id?: unknown
      sourceUrl?: unknown
      brightness?: unknown
      highlights?: unknown
      shadows?: unknown
      contrast?: unknown
    }
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const sourceUrl = typeof record.sourceUrl === "string" ? record.sourceUrl.trim() : ""
    if (!id || !sourceUrl) continue
    const tone = listingPhotoToneFromStops(record)
    if (isListingPhotoToneIdentity(tone)) continue
    recipes.push({ id, sourceUrl, tone })
  }
  return recipes
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
  /** Public files that must survive, including a seller's replacement photo. */
  keepUrls?: ReadonlyArray<string | null | undefined>
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

  const keep = new Set<string>()
  if (source) keep.add(source)
  for (const url of input.keepUrls ?? []) {
    const next = url?.trim() ?? ""
    if (next) keep.add(next)
  }
  return [...new Set(urls)].filter((url) => !keep.has(url))
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

