import {
  clearImpersonation,
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
 * Best-effort: set the impersonation cookie to this listing's seller before
 * an admin save. Update-listing and owned-edit no longer require the cookie.
 */
export async function ensureImpersonationForListingOwner(
  ownerUserId: string,
): Promise<void> {
  const trimmed = ownerUserId.trim()
  if (!trimmed) return
  const current = getActiveImpersonationClient()
  if (current?.userId === trimmed) return
  try {
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: trimmed }),
    })
    if (!res.ok) return
    const data = (await res.json().catch(() => ({}))) as {
      displayName?: string
      email?: string | null
    }
    setImpersonation({
      userId: trimmed,
      displayName:
        typeof data.displayName === "string" && data.displayName.trim()
          ? data.displayName.trim()
          : "User",
      email: typeof data.email === "string" ? data.email : null,
    })
  } catch {
    // Cookie may already be present; update-listing allows admin without it.
  }
}

/**
 * Point client impersonation at this listing's seller. Retargets a leftover
 * cookie instead of wiping it — wiping hid the Acting as banner and broke Save.
 */
export async function syncClientImpersonationForListingOwner(
  listingOwnerId: string,
): Promise<ImpersonationData | null> {
  const ownerId = listingOwnerId.trim()
  if (!ownerId) return getActiveImpersonationClient()

  const current = getActiveImpersonationClient()
  if (current?.userId === ownerId) {
    setImpersonation(current)
    return current
  }

  await ensureImpersonationForListingOwner(ownerId)
  const next = getActiveImpersonationClient()
  if (next?.userId === ownerId) {
    setImpersonation(next)
    return next
  }

  if (current) clearImpersonation()
  return null
}
