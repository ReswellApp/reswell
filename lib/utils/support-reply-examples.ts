export const SUPPORT_REPLY_EXAMPLES_PATH = "/admin/support-reply-examples"

export function supportReplyExamplesPageCount(total: number, limit: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, limit)))
}

export function clampSupportReplyExamplesPage(page: number, total: number, limit: number): number {
  const maxPage = supportReplyExamplesPageCount(total, limit)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.trunc(page), maxPage)
}

/** Escape ILIKE wildcards; keep punctuation. Strip only `"` so PostgREST quoted filters stay valid. */
export function supportReplyExampleSearchPattern(q?: string): string | null {
  const trimmed = q?.trim() ?? ""
  if (!trimmed) return null
  const escaped = trimmed
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/"/g, "")
  return escaped || null
}

export function supportReplyExampleSearchOrClause(q?: string): string | null {
  const pattern = supportReplyExampleSearchPattern(q)
  if (!pattern) return null
  return `customer_excerpt.ilike."%${pattern}%",staff_reply.ilike."%${pattern}%"`
}

export function supportReplyExamplesHref(filters: {
  rating?: string
  kind?: string
  q?: string
  page?: number
}): string {
  const params = new URLSearchParams()
  if (filters.rating) params.set("rating", filters.rating)
  if (filters.kind) params.set("kind", filters.kind)
  if (filters.q?.trim()) params.set("q", filters.q.trim())
  if (filters.page && filters.page > 1) params.set("page", String(filters.page))
  const qs = params.toString()
  return qs ? `${SUPPORT_REPLY_EXAMPLES_PATH}?${qs}` : SUPPORT_REPLY_EXAMPLES_PATH
}
