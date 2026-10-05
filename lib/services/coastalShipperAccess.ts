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
