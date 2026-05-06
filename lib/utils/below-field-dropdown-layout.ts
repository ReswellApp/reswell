export type BelowFieldDropdownLayout = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type ComputeArgs = {
  /** Gap between field bottom and panel top (CSS px). */
  gap?: number
  minListWidth?: number
  maxListWidth?: number
  maxHeightCap?: number
  minMaxHeight?: number
  horizontalGutter?: number
  bottomGutter?: number
}

/**
 * Compute `position: fixed` coordinates for a dropdown that must sit **below** the anchor element
 * and never move above it. Uses {@link VisualViewport} when available so keyboard / iOS chrome
 * doesn’t leave the panel overlapping the field.
 */
export function computeBelowFieldDropdownLayout(
  anchorEl: HTMLElement,
  args?: ComputeArgs,
): BelowFieldDropdownLayout {
  const gap = args?.gap ?? 8
  const minListWidth = args?.minListWidth ?? 280
  const maxListWidth = args?.maxListWidth ?? 520
  const maxHeightCap = args?.maxHeightCap ?? 360
  const minMaxHeight = args?.minMaxHeight ?? 120
  const horizontalGutter = args?.horizontalGutter ?? 16
  const bottomGutter = args?.bottomGutter ?? 12

  const rect = anchorEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vv = window.visualViewport
  const viewportBottom = vv ? vv.offsetTop + vv.height : window.innerHeight

  const top = rect.bottom + gap

  const rawTargetWidth = Math.min(Math.max(rect.width, minListWidth), maxListWidth)
  const width = Math.min(rawTargetWidth, vw - 2 * horizontalGutter)
  const left = Math.max(horizontalGutter, Math.min(rect.left, vw - width - horizontalGutter))

  const spaceBelow = viewportBottom - top - bottomGutter
  const maxHeight = Math.min(maxHeightCap, Math.max(minMaxHeight, spaceBelow))

  return { top, left, width, maxHeight }
}
