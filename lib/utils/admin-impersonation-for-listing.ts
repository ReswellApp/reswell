import {
  getActiveImpersonationClient,
  setImpersonation,
  type ImpersonationData,
} from "@/lib/impersonation"

/** True when a signed-in admin is editing a listing they do not own. */
export function adminIsEditingAnotherUsersListing(args: {
  actorIsAdmin: boolean
  actorUserId: string
  listingOwnerId: string | null | undefined
}): boolean {
  if (!args.actorIsAdmin) return false
  const ownerId = args.listingOwnerId?.trim()
  if (!ownerId) return false
  return args.actorUserId !== ownerId
}

/**
 * Refresh client storage when the admin is already acting as this seller.
 * Does not start impersonation — that belongs to /admin/listings (and other
 * explicit Act as User entry points). Public /l → edit must stay banner-free.
 * Update-listing and owned-edit no longer require the cookie.
 */
export async function ensureImpersonationForListingOwner(
  ownerUserId: string,
): Promise<void> {
  const trimmed = ownerUserId.trim()
  if (!trimmed) return
  const current = getActiveImpersonationClient()
  if (current?.userId === trimmed) {
    setImpersonation(current)
  }
}

/**
 * Keep an existing admin impersonation session if it already matches this
 * listing's seller. Does not start or retarget impersonation from a public
 * listing edit — that made Acting as appear after /l → Edit.
 */
export async function syncClientImpersonationForListingOwner(
  listingOwnerId: string,
): Promise<ImpersonationData | null> {
  const ownerId = listingOwnerId.trim()
  const current = getActiveImpersonationClient()
  if (!ownerId) return current
  if (current?.userId === ownerId) {
    setImpersonation(current)
    return current
  }
  return current
}
