export type ListingPdpCrop = {
  /** 0 = contain (entire photo visible), 1 = cover (fill the frame), >1 extra zoom. */
  zoom: number
  x: number
  y: number
}

export type ListingPdpCropLayout = {
  width: number
  height: number
  left: number
  top: number
}

export const LISTING_PDP_CROP_COVER: ListingPdpCrop = { zoom: 1, x: 50, y: 50 }
export const LISTING_PDP_CROP_FIT: ListingPdpCrop = { zoom: 0, x: 50, y: 50 }
export const LISTING_PDP_CROP_MAX_ZOOM = 4
export const LISTING_PDP_CROP_OPEN_EVENT = "reswell:open-listing-pdp-crop"

const ZOOM_EPS = 0.0001

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampPct(value: number): number {
  return clamp(value, 0, 100)
}

function parseFinite(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function clampListingPdpCrop(crop: ListingPdpCrop): ListingPdpCrop {
  return {
    zoom: clamp(crop.zoom, 0, LISTING_PDP_CROP_MAX_ZOOM),
    x: clampPct(crop.x),
    y: clampPct(crop.y),
  }
}

/** Null columns mean no seller crop. The /l hero then uses contain. */
export function resolveListingPdpCrop(
  zoom: unknown,
  x: unknown,
  y: unknown,
): ListingPdpCrop | null {
  const parsedZoom = parseFinite(zoom)
  const parsedX = parseFinite(x)
  const parsedY = parseFinite(y)
  if (parsedZoom == null && parsedX == null && parsedY == null) return null
  return clampListingPdpCrop({
    zoom: parsedZoom ?? LISTING_PDP_CROP_COVER.zoom,
    x: parsedX ?? LISTING_PDP_CROP_COVER.x,
    y: parsedY ?? LISTING_PDP_CROP_COVER.y,
  })
}

export function listingPdpCropFromImageRow(row: {
  pdp_crop_zoom?: unknown
  pdp_crop_x?: unknown
  pdp_crop_y?: unknown
}): ListingPdpCrop | null {
  return resolveListingPdpCrop(row.pdp_crop_zoom, row.pdp_crop_x, row.pdp_crop_y)
}

/** Unset or Fit — the /l hero already contains. Fill (cover) is an explicit save. */
export function isListingPdpCropDefault(crop: ListingPdpCrop | null | undefined): boolean {
  if (!crop) return true
  return (
    Math.abs(crop.zoom - LISTING_PDP_CROP_FIT.zoom) < ZOOM_EPS &&
    Math.abs(crop.x - LISTING_PDP_CROP_FIT.x) < 0.05 &&
    Math.abs(crop.y - LISTING_PDP_CROP_FIT.y) < 0.05
  )
}

export function listingPdpContainScale(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
): number {
  if (frameW <= 0 || frameH <= 0 || imageW <= 0 || imageH <= 0) return 0
  return Math.min(frameW / imageW, frameH / imageH)
}

export function listingPdpCoverScale(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
): number {
  if (frameW <= 0 || frameH <= 0 || imageW <= 0 || imageH <= 0) return 0
  return Math.max(frameW / imageW, frameH / imageH)
}

/** Pixel scale for a stored zoom: 0…1 interpolates contain→cover, above 1 multiplies cover. */
export function listingPdpRenderScale(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
  zoom: number,
): number {
  const contain = listingPdpContainScale(frameW, frameH, imageW, imageH)
  const cover = listingPdpCoverScale(frameW, frameH, imageW, imageH)
  const z = clamp(zoom, 0, LISTING_PDP_CROP_MAX_ZOOM)
  if (z <= 1) return contain + z * (cover - contain)
  return cover * z
}

export function listingPdpZoomFromRenderScale(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
  renderScale: number,
): number {
  const contain = listingPdpContainScale(frameW, frameH, imageW, imageH)
  const cover = listingPdpCoverScale(frameW, frameH, imageW, imageH)
  if (contain <= 0 || cover <= 0 || renderScale <= 0) return 1
  if (renderScale <= cover + ZOOM_EPS) {
    if (Math.abs(cover - contain) < ZOOM_EPS) return renderScale >= cover ? 1 : 0
    return clamp((renderScale - contain) / (cover - contain), 0, 1)
  }
  return clamp(renderScale / cover, 1, LISTING_PDP_CROP_MAX_ZOOM)
}

export function listingPdpCropToLayout(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
  crop: ListingPdpCrop,
): ListingPdpCropLayout {
  const scale = listingPdpRenderScale(frameW, frameH, imageW, imageH, crop.zoom)
  const width = imageW * scale
  const height = imageH * scale
  return {
    width,
    height,
    left: frameW * (crop.x / 100) - width * (crop.x / 100),
    top: frameH * (crop.y / 100) - height * (crop.y / 100),
  }
}

export function listingPdpLayoutToCrop(
  frameW: number,
  frameH: number,
  imageW: number,
  imageH: number,
  layout: ListingPdpCropLayout,
): ListingPdpCrop {
  const scale = imageW > 0 ? layout.width / imageW : 1
  const zoom = listingPdpZoomFromRenderScale(frameW, frameH, imageW, imageH, scale)
  const spanX = frameW - layout.width
  const spanY = frameH - layout.height
  return clampListingPdpCrop({
    zoom,
    x: Math.abs(spanX) < 0.5 ? 50 : (layout.left / spanX) * 100,
    y: Math.abs(spanY) < 0.5 ? 50 : (layout.top / spanY) * 100,
  })
}

/** Keep the photo overlapping the frame. Smaller-than-frame axes stay centered. */
export function clampListingPdpCropLayout(
  frameW: number,
  frameH: number,
  layout: ListingPdpCropLayout,
): ListingPdpCropLayout {
  let { left, top, width, height } = layout
  if (width <= frameW) {
    left = (frameW - width) / 2
  } else {
    left = clamp(left, frameW - width, 0)
  }
  if (height <= frameH) {
    top = (frameH - height) / 2
  } else {
    top = clamp(top, frameH - height, 0)
  }
  return { width, height, left, top }
}

export function applyListingPdpCropPan(params: {
  layout: ListingPdpCropLayout
  deltaX: number
  deltaY: number
  frameW: number
  frameH: number
}): ListingPdpCropLayout {
  return clampListingPdpCropLayout(params.frameW, params.frameH, {
    ...params.layout,
    left: params.layout.left + params.deltaX,
    top: params.layout.top + params.deltaY,
  })
}

export function applyListingPdpCropZoom(params: {
  layout: ListingPdpCropLayout
  factor: number
  originX: number
  originY: number
  frameW: number
  frameH: number
  imageW: number
  imageH: number
}): ListingPdpCropLayout {
  const { layout, originX, originY, frameW, frameH, imageW, imageH } = params
  if (imageW <= 0 || imageH <= 0 || layout.width <= 0) return layout

  const minScale = listingPdpContainScale(frameW, frameH, imageW, imageH)
  const maxScale = listingPdpCoverScale(frameW, frameH, imageW, imageH) * LISTING_PDP_CROP_MAX_ZOOM
  const nextScale = clamp((layout.width / imageW) * params.factor, minScale, maxScale)
  const nextW = imageW * nextScale
  const nextH = imageH * nextScale
  const focusX = (originX - layout.left) / layout.width
  const focusY = (originY - layout.top) / layout.height

  return clampListingPdpCropLayout(frameW, frameH, {
    width: nextW,
    height: nextH,
    left: originX - focusX * nextW,
    top: originY - focusY * nextH,
  })
}

export function listingPdpCropObjectPosition(crop: ListingPdpCrop): string {
  return `${crop.x}% ${crop.y}%`
}

/**
 * CSS-only first paint. Intermediate zooms refine with a measured layout after load.
 * null (thumbs) and zoom 1 → cover. zoom 0 → contain.
 */
export function listingPdpCropCssFit(crop: ListingPdpCrop | null): "cover" | "contain" {
  if (!crop) return "cover"
  if (crop.zoom <= ZOOM_EPS) return "contain"
  return "cover"
}

export function listingPdpCropNeedsPreciseLayout(crop: ListingPdpCrop | null): boolean {
  if (!crop || crop.zoom <= ZOOM_EPS) return false
  return Math.abs(crop.zoom - 1) > ZOOM_EPS
}

export function listingPdpCropsEqual(
  a: ListingPdpCrop | null | undefined,
  b: ListingPdpCrop | null | undefined,
): boolean {
  if (isListingPdpCropDefault(a) && isListingPdpCropDefault(b)) return true
  if (!a || !b) return false
  return (
    Math.abs(a.zoom - b.zoom) < 0.001 &&
    Math.abs(a.x - b.x) < 0.05 &&
    Math.abs(a.y - b.y) < 0.05
  )
}

export function openListingPdpCropEditor(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(LISTING_PDP_CROP_OPEN_EVENT))
}
