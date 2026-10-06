/** A job is visible when it is assigned to this shipper or matched to one of their runs. */
export function coastalJobVisibleToShipper(input: {
  shipperId: string
  requestShipperId: string | null
  matchedRunId: string | null
  runIds: readonly string[]
}): boolean {
  if (input.requestShipperId === input.shipperId) return true
  return input.matchedRunId != null && input.runIds.includes(input.matchedRunId)
}

/** Profile email wins. Auth login email is the fallback so a grant still writes coastal_shippers.user_id. */
export function resolveCoastalShipperGrantUserId(input: {
  profileIds: string[]
  authUserId: string | null
}): { userId: string } | { error: string } {
  if (input.profileIds.length > 1) return { error: "More than one account uses that email." }
  const userId = input.profileIds[0] ?? input.authUserId
  if (!userId) return { error: "No Reswell account uses that email." }
  return { userId }
}

/**
 * A granted shipper is a `coastal_shippers` row for this user.
 * Schedule on, admin, and having a run do not grant the link.
 */
export function coastalShipperMembership(input: { rowId: unknown; queryFailed: boolean }): boolean {
  return !input.queryFailed && typeof input.rowId === "string" && input.rowId.length > 0
}

/** Who may open a shipper run dashboard. Anonymous and everyone else get not found. */
export function authorizeCoastalShipperView(input: {
  userId: string | null
  isAdmin: boolean
  /** Owner of the shipper row. Null when that row does not exist. */
  shipperUserId: string | null
}): "allow" | "not_found" {
  if (!input.userId || !input.shipperUserId) return "not_found"
  if (input.shipperUserId === input.userId) return "allow"
  if (input.isAdmin) return "allow"
  return "not_found"
}
