export type ProfileBannerFocal = {
  x: number
  y: number
}

export const PROFILE_BANNER_FOCAL_DEFAULT: ProfileBannerFocal = { x: 50, y: 50 }

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function parsePct(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || Number.isNaN(raw)) return null
  return clampPct(raw)
}

/** Coalesce nullable DB focal columns to a safe object-position pair. */
export function resolveProfileBannerFocal(
  focalX: number | null | undefined,
  focalY: number | null | undefined,
): ProfileBannerFocal {
  return {
    x: parsePct(focalX) ?? PROFILE_BANNER_FOCAL_DEFAULT.x,
    y: parsePct(focalY) ?? PROFILE_BANNER_FOCAL_DEFAULT.y,
  }
}

export function profileBannerObjectPosition(focal: ProfileBannerFocal): string {
  return `${focal.x}% ${focal.y}%`
}

/** Pixel overflow available for object-fit: cover panning in a container. */
export function objectCoverOverflowPx(params: {
  containerWidth: number
  containerHeight: number
  imageWidth: number
  imageHeight: number
}): { overflowX: number; overflowY: number } {
  const { containerWidth, containerHeight, imageWidth, imageHeight } = params
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { overflowX: 0, overflowY: 0 }
  }

  const scale = Math.max(containerWidth / imageWidth, containerHeight / imageHeight)
  const scaledW = imageWidth * scale
  const scaledH = imageHeight * scale
  return {
    overflowX: Math.max(0, scaledW - containerWidth),
    overflowY: Math.max(0, scaledH - containerHeight),
  }
}

/** Drag delta → next focal point for object-fit: cover previews. */
export function applyBannerFocalDrag(params: {
  focal: ProfileBannerFocal
  deltaX: number
  deltaY: number
  containerWidth: number
  containerHeight: number
  imageWidth: number
  imageHeight: number
}): ProfileBannerFocal {
  const {
    focal,
    deltaX,
    deltaY,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
  } = params

  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return focal
  }

  const { overflowX, overflowY } = objectCoverOverflowPx({
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
  })

  const nextX =
    overflowX > 0 ? focal.x - (deltaX / overflowX) * 100 : focal.x
  const nextY =
    overflowY > 0 ? focal.y - (deltaY / overflowY) * 100 : focal.y

  return {
    x: clampPct(nextX),
    y: clampPct(nextY),
  }
}
