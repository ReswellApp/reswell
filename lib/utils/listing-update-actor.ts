/** Owner and admin updates must never change identity / visibility columns from the client. */
export const LISTING_UPDATE_FORBIDDEN_FIELDS = new Set([
  "id",
  "user_id",
  "created_at",
  "slug",
  "status",
  "hidden_from_site",
  "site_visibility_reason",
  "auto_price_drop_scheduled_for",
])

export function listingFieldsForPeerUpdate(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (LISTING_UPDATE_FORBIDDEN_FIELDS.has(key)) continue
    next[key] = value
  }
  return next
}

/**
 * Owner saves stay on the owner write path even when the actor is an admin.
 * Admin fallback is only for someone else's listing. Mixing those two is what
 * kept breaking either admin edit or normal seller updates.
 */
export function resolveListingUpdateActor(args: {
  actorIsAdmin: boolean
  actorUserId: string
  listingOwnerId: string | null | undefined
}): "owner" | "admin" | "forbidden" {
  const ownerId = args.listingOwnerId?.trim()
  const actorId = args.actorUserId.trim()
  if (!ownerId || !actorId) return "forbidden"
  if (actorId === ownerId) return "owner"
  if (args.actorIsAdmin) return "admin"
  return "forbidden"
}
