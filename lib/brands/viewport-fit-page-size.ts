/** Clamp page size into inclusive bounds. */
export function clampPageSize(size: number, minPageSize: number, maxPageSize: number): number {
  const min = Math.max(1, Math.floor(minPageSize))
  const max = Math.max(min, Math.floor(maxPageSize))
  if (!Number.isFinite(size)) return min
  return Math.min(max, Math.max(min, Math.floor(size)))
}

/**
 * How many grid items fit between `listTop` and the bottom of the viewport,
 * leaving room for the pager so Next/Back stay on screen.
 */
export function viewportFitPageSize(input: {
  viewportHeight: number
  listTop: number
  rowStridePx: number
  columns: number
  pagerReservePx: number
  bottomPadPx?: number
  minPageSize?: number
  maxPageSize?: number
}): number {
  const minPageSize = input.minPageSize ?? 4
  const maxPageSize = input.maxPageSize ?? 40
  const bottomPadPx = input.bottomPadPx ?? 24
  const columns = Math.max(1, Math.floor(input.columns))
  const rowStride = Math.max(1, input.rowStridePx)

  const available = input.viewportHeight - input.listTop - input.pagerReservePx - bottomPadPx
  if (available < rowStride) {
    return clampPageSize(columns, minPageSize, maxPageSize)
  }

  const rows = Math.max(1, Math.floor(available / rowStride))
  return clampPageSize(rows * columns, minPageSize, maxPageSize)
}

export function brandDirectoryColumnsForWidth(width: number): number {
  if (width < 640) return 1
  if (width < 768) return 2
  if (width < 1024) return 3
  if (width < 1280) return 4
  return 5
}

export function brandModelColumnsForWidth(width: number): number {
  if (width < 640) return 1
  if (width < 1024) return 2
  return 3
}
