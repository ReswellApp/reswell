export const SUPPORT_REPLY_EXAMPLES_PATH = "/admin/support-reply-examples"

export function supportReplyExamplesPageCount(total: number, limit: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, limit)))
}

export function clampSupportReplyExamplesPage(page: number, total: number, limit: number): number {
  const maxPage = supportReplyExamplesPageCount(total, limit)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.trunc(page), maxPage)
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
