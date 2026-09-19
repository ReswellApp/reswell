/** Query used in Klaviyo “Support Tickets Response” emails to reopen the widget. */
export const LIVE_CHAT_RESUME_QUERY = "chat"

const PUBLIC_ID_RE = /^lc_[a-f0-9]{16}$/i

export function parseLiveChatResumePublicId(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim() ?? ""
  if (!PUBLIC_ID_RE.test(value)) return null
  return `lc_${value.slice(3).toLowerCase()}`
}

/** Site-relative resume link, e.g. `/?chat=lc_…`. */
export function liveChatVisitorResumeHref(publicId: string): string {
  const id = parseLiveChatResumePublicId(publicId)
  if (!id) return "/"
  return `/?${LIVE_CHAT_RESUME_QUERY}=${encodeURIComponent(id)}`
}

export function liveChatVisitorResumeAbsoluteUrl(
  origin: string,
  publicId: string,
): string {
  const base = origin.replace(/\/$/, "")
  return `${base}${liveChatVisitorResumeHref(publicId)}`
}
