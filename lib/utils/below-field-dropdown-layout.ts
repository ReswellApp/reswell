export type BelowFieldDropdownLayout = {
  top: number
  left: number
  width: number
  maxHeight: number
}

export type FieldDropdownRect = {
  top: number
  left: number
  bottom: number
  width: number
}

export type FieldDropdownViewport = {
  width: number
  height: number
  offsetTop: number
  visualHeight: number
}

export type ComputeBelowFieldDropdownArgs = {
  /** Gap between field bottom and panel top (CSS px). Overrides {@link ComputeBelowFieldDropdownArgs#gapNarrow} / wide default when set. */
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
  topGutter?: number
  /**
   * When there isn’t enough room below the field, pin the panel above it.
   * Default stays below-only so existing sell-form callers keep their layout.
   */
  allowFlip?: boolean
}

/**
 * Pure layout for a `position: fixed` typeahead panel. Exported for unit tests.
 */
export function layoutFieldDropdown(
  rect: FieldDropdownRect,
  viewport: FieldDropdownViewport,
  args?: ComputeBelowFieldDropdownArgs,
): BelowFieldDropdownLayout {
  const vw = viewport.width
  const gapBp = args?.gapBreakpoint ?? 640
  const defaultNarrowGap = args?.gapNarrow ?? 12
  const defaultWideGap = args?.gapWide ?? 8
  const gap = args?.gap ?? (vw < gapBp ? defaultNarrowGap : defaultWideGap)
  const minListWidth = args?.minListWidth ?? 280
  const maxListWidth = args?.maxListWidth ?? 520
  const maxHeightCap = args?.maxHeightCap ?? 360
  const minMaxHeight = args?.minMaxHeight ?? 120
  const horizontalGutter = args?.horizontalGutter ?? 16
  const bottomGutter = args?.bottomGutter ?? 12
  const topGutter = args?.topGutter ?? 12
  const allowFlip = args?.allowFlip === true

  const viewportTop = viewport.offsetTop
  const viewportBottom = viewport.offsetTop + viewport.visualHeight

  const rawTargetWidth = Math.min(Math.max(rect.width, minListWidth), maxListWidth)
  const width = Math.min(rawTargetWidth, Math.max(0, vw - 2 * horizontalGutter))
  const left = Math.max(horizontalGutter, Math.min(rect.left, vw - width - horizontalGutter))

  const belowTop = Math.ceil(rect.bottom) + gap
  const spaceBelow = viewportBottom - belowTop - bottomGutter
  const spaceAbove = rect.top - viewportTop - topGutter - gap

  const shouldFlip =
    allowFlip && spaceBelow < minMaxHeight && spaceAbove > spaceBelow && spaceAbove >= minMaxHeight

  if (shouldFlip) {
    const maxHeight = Math.min(maxHeightCap, Math.max(minMaxHeight, spaceAbove))
    const top = Math.max(viewportTop + topGutter, Math.floor(rect.top) - gap - maxHeight)
    return { top, left, width, maxHeight }
  }

  const maxHeight = Math.min(maxHeightCap, Math.max(minMaxHeight, spaceBelow))
  return { top: belowTop, left, width, maxHeight }
}

/**
 * Compute `position: fixed` coordinates for a dropdown that sits below the anchor
 * (or above it when {@link ComputeBelowFieldDropdownArgs.allowFlip} is set and
 * there isn’t enough room). Uses {@link VisualViewport} when available so
 * keyboard / iOS chrome doesn’t leave the panel overlapping the field.
 */
export function computeBelowFieldDropdownLayout(
  anchorEl: HTMLElement,
  args?: ComputeBelowFieldDropdownArgs,
): BelowFieldDropdownLayout {
  const rect = anchorEl.getBoundingClientRect()
  const vv = window.visualViewport
  return layoutFieldDropdown(
    { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width },
    {
      width: window.innerWidth,
      height: window.innerHeight,
      offsetTop: vv?.offsetTop ?? 0,
      visualHeight: vv?.height ?? window.innerHeight,
    },
    args,
  )
}
