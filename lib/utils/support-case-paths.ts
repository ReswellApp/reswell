/**
 * Canonical Help case URLs — use these in emails, lists, and CTAs.
 * Legacy `/dashboard/support/...` paths redirect here.
 * Staff deep links open the inbox with the case selected — one composer.
 */

export const ADMIN_SUPPORT_INBOX_PATH = "/admin/contact-messages"

export function inboxCaseKey(caseId: string): string {
  return `sc:${parseInboxCaseParam(caseId) ?? caseId.trim()}`
}

export function inboxContactKey(contactMessageId: string): string {
  return `cm:${parseInboxCaseParam(contactMessageId) ?? contactMessageId.trim()}`
}

export function inboxOrderSupportKey(orderSupportId: string): string {
  return `os:${parseInboxCaseParam(orderSupportId) ?? orderSupportId.trim()}`
}

/** Keep an explicit sc/cm/os prefix; default a bare id to a support_case key. */
export function inboxSelectionKey(raw: string): string {
  const trimmed = raw.trim()
  const prefixed = trimmed.match(/^(sc|cm|os):(.+)$/i)
  if (prefixed?.[1] && prefixed[2]) {
    return `${prefixed[1].toLowerCase()}:${prefixed[2]}`
  }
  return inboxCaseKey(trimmed)
}

/** Accept `sc:{uuid}`, `cm:{uuid}`, `os:{uuid}`, or a raw uuid. */
export function parseInboxCaseParam(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const prefixed = trimmed.match(/^(?:sc|cm|os):(.+)$/i)
  return (prefixed?.[1] ?? trimmed).trim() || null
}

export function supportCaseResponseHref(caseId: string): string {
  return `/support/${caseId}`
}

/** Member case thread (`/support/[id]`) — not the hub. */
export function isSupportCaseThreadRoute(pathname: string | null): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "") || "/"
  return /^\/support\/[^/]+$/.test(normalized)
}

export function supportCaseResponseAbsoluteUrl(origin: string, caseId: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}${supportCaseResponseHref(caseId)}`
}

export function adminSupportCaseHref(caseId: string): string {
  return `${ADMIN_SUPPORT_INBOX_PATH}?case=${encodeURIComponent(inboxSelectionKey(caseId))}`
}

export const ADMIN_LIVE_CHAT_PATH = "/admin/live-chat"

/** Staff deep link into the live-chat desk for a session UUID. */
export function adminLiveChatSessionHref(sessionId: string): string {
  return `${ADMIN_LIVE_CHAT_PATH}?session=${encodeURIComponent(sessionId.trim())}`
}

/** Open the live-chat desk filtered to the case’s linked session. */
export function adminLiveChatHrefForCase(caseId: string): string {
  return `${ADMIN_LIVE_CHAT_PATH}?case=${encodeURIComponent(caseId.trim())}`
}
