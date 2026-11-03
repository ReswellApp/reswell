/** Sliding window of 1-based page numbers for local (URL-stable) pagers. */
export function localPagerPageNumbers(current: number, totalPages: number, maxButtons = 5): number[] {
  if (totalPages <= 0) return []
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const half = Math.floor(maxButtons / 2)
  let start = Math.max(1, current - half)
  let end = start + maxButtons - 1
  if (end > totalPages) {
    end = totalPages
    start = Math.max(1, end - maxButtons + 1)
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/** Human range label for the current page slice, e.g. "Showing 1–12 of 111". */
export function localPagerRangeLabel(page: number, pageSize: number, total: number): string {
  const safeTotal = Math.max(0, Math.floor(total))
  if (safeTotal === 0) return "Showing 0"
  const size = Math.max(1, Math.floor(pageSize))
  const safePage = Math.max(1, Math.floor(page))
  const start = (safePage - 1) * size + 1
  const end = Math.min(safePage * size, safeTotal)
  const startLabel = start.toLocaleString("en-US")
  const endLabel = end.toLocaleString("en-US")
  const totalLabel = safeTotal.toLocaleString("en-US")
  if (start === end) return `Showing ${startLabel} of ${totalLabel}`
  return `Showing ${startLabel}–${endLabel} of ${totalLabel}`
}
