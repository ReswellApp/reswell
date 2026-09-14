/**
 * Canonical Help case URLs — use these in emails, lists, and CTAs.
 * Legacy `/dashboard/support/...` paths redirect here.
 * Staff deep links open the inbox with the case selected — one composer.
 */

export const ADMIN_SUPPORT_INBOX_PATH = "/admin/contact-messages"

export function inboxCaseKey(caseId: string): string {
  return `sc:${caseId}`
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

export function supportCaseResponseAbsoluteUrl(origin: string, caseId: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}${supportCaseResponseHref(caseId)}`
}

export function adminSupportCaseHref(caseId: string): string {
  return `${ADMIN_SUPPORT_INBOX_PATH}?case=${encodeURIComponent(inboxCaseKey(caseId))}`
}
