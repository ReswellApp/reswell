export type BelowFieldDropdownLayout = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type ComputeArgs = {
  /** Gap between field bottom and panel top (CSS px). Overrides {@link ComputeArgs#gapNarrow} / wide default when set. */
  gap?: number
  /** When `gap` is omitted, gap for narrow viewports (typically mobile). */
  gapNarrow?: number
  /** When `gap` is omitted, gap for wider viewports. */
  gapWide?: number
  /** Breakpoint (CSS px) — viewports **below** this use narrow gap defaults. */
  gapBreakpoint?: number
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
  const vw = window.innerWidth
  const gapBp = args?.gapBreakpoint ?? 640
  const defaultNarrowGap = args?.gapNarrow ?? 12
  const defaultWideGap = args?.gapWide ?? 8
  const gap =
    args?.gap ?? (vw < gapBp ? defaultNarrowGap : defaultWideGap)
  const minListWidth = args?.minListWidth ?? 280
  const maxListWidth = args?.maxListWidth ?? 520
  const maxHeightCap = args?.maxHeightCap ?? 360
  const minMaxHeight = args?.minMaxHeight ?? 120
  const horizontalGutter = args?.horizontalGutter ?? 16
  const bottomGutter = args?.bottomGutter ?? 12

  const rect = anchorEl.getBoundingClientRect()
  const vv = window.visualViewport
  const viewportBottom = vv ? vv.offsetTop + vv.height : window.innerHeight

  /** Ceil so the first paint row of the panel is never above the anchor’s bottom edge (subpixel / DPR quirks). */
  const top = Math.ceil(rect.bottom) + gap

  const rawTargetWidth = Math.min(Math.max(rect.width, minListWidth), maxListWidth)
  const width = Math.min(rawTargetWidth, vw - 2 * horizontalGutter)
  const left = Math.max(horizontalGutter, Math.min(rect.left, vw - width - horizontalGutter))

  const spaceBelow = viewportBottom - top - bottomGutter
  const maxHeight = Math.min(maxHeightCap, Math.max(minMaxHeight, spaceBelow))

  return { top, left, width, maxHeight }
}
