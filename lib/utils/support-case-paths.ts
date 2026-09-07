/**
 * Canonical Help case URLs — use these in emails, lists, and CTAs.
 * Legacy `/dashboard/support/...` paths redirect here.
 */

export function supportCaseResponseHref(caseId: string): string {
  return `/support/${caseId}`
}

export function supportCaseResponseAbsoluteUrl(origin: string, caseId: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}${supportCaseResponseHref(caseId)}`
}

export function adminSupportCaseHref(caseId: string): string {
  return `/admin/support/${caseId}`
}
