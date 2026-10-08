/**
 * A granted dropoff operator is a `dropoff_location_grants` row for this user.
 * Admin, and seeing the location in admin, do not grant the dashboard link.
 */
export function dropoffLocationMembership(input: { rowId: unknown; queryFailed: boolean }): boolean {
  return !input.queryFailed && typeof input.rowId === "string" && input.rowId.length > 0
}

/** Profile email wins. Auth login email is the fallback so a grant still writes user_id. */
export function resolveDropoffLocationGrantUserId(input: {
  profileIds: string[]
  authUserId: string | null
}): { userId: string } | { error: string } {
  if (input.profileIds.length > 1) return { error: "More than one account uses that email." }
  const userId = input.profileIds[0] ?? input.authUserId
  if (!userId) return { error: "No Reswell account uses that email." }
  return { userId }
}

/**
 * Who may open /dashboard/dropoff-location.
 * The signed-in user must own the grant. Admin without a grant is not found.
 */
export function authorizeDropoffLocationView(input: {
  userId: string | null
  grantUserId: string | null
}): "allow" | "not_found" {
  if (!input.userId || !input.grantUserId) return "not_found"
  if (input.grantUserId === input.userId) return "allow"
  return "not_found"
}

/** An order belongs to a dropoff site when any of its listings is assigned there. */
export function orderBelongsToDropoffLocation(input: {
  locationId: string
  listingDropoffIds: Array<string | null | undefined>
}): boolean {
  return input.listingDropoffIds.some((id) => id === input.locationId)
}
