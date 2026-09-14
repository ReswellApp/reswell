export const SUPPORT_REPLY_EXAMPLES_PATH = "/admin/support-reply-examples"

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
