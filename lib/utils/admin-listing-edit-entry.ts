export const ADMIN_LISTING_EDIT_FROM_PARAM = "from"
export const ADMIN_LISTING_EDIT_FROM_VALUE = "admin"

export function isAdminListingEditEntry(
  searchParams: { get: (name: string) => string | null } | null | undefined,
): boolean {
  return searchParams?.get(ADMIN_LISTING_EDIT_FROM_PARAM) === ADMIN_LISTING_EDIT_FROM_VALUE
}

/** Mark a sell-edit URL as started from /admin/listings so Acting as can show. */
export function withAdminListingEditEntry(href: string): string {
  const hashIndex = href.indexOf("#")
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : ""
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href
  const qIndex = withoutHash.indexOf("?")
  if (qIndex === -1) {
    return `${withoutHash}?${ADMIN_LISTING_EDIT_FROM_PARAM}=${ADMIN_LISTING_EDIT_FROM_VALUE}${hash}`
  }
  const params = new URLSearchParams(withoutHash.slice(qIndex + 1))
  params.set(ADMIN_LISTING_EDIT_FROM_PARAM, ADMIN_LISTING_EDIT_FROM_VALUE)
  return `${withoutHash.slice(0, qIndex)}?${params.toString()}${hash}`
}

export function isPublicListingPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === "/l" || pathname.startsWith("/l/")
}

export function isSellFlowPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === "/sell" || pathname.startsWith("/sell/")
}

/**
 * Acting as belongs on explicit admin impersonation (users, add listing, wallets)
 * and on sell-edit that started from /admin/listings. Public listing pages and
 * sell-edit opened from /l must not show it.
 */
export function shouldShowImpersonationActingAsBanner(
  pathname: string | null | undefined,
  searchParams: { get: (name: string) => string | null } | null | undefined,
): boolean {
  if (isPublicListingPath(pathname)) return false
  if (
    isSellFlowPath(pathname) &&
    Boolean(searchParams?.get("edit")?.trim()) &&
    !isAdminListingEditEntry(searchParams)
  ) {
    return false
  }
  return true
}
