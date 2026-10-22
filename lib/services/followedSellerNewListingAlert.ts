import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { dbClaimFollowedSellerListingAlerts } from "@/lib/db/followedSellerListingAlerts"
import {
  followedSellerNewListingDayKey,
  type FollowedSellerNewListingAlertClaim,
} from "@/lib/services/followedSellerNewListingCap"

export {
  followedSellerNewListingAlertMaySend,
  followedSellerNewListingDayKey,
  recipientsAllowedByListingAlertCap,
  type FollowedSellerNewListingAlertClaim,
} from "@/lib/services/followedSellerNewListingCap"

const listingIdSchema = z.string().uuid()
const recipientIdSchema = z.string().uuid()

/**
 * Reserve today's slot for each follower. `granted` is a new slot, `already_granted`
 * is a retry of the same listing (safe to send again; Klaviyo uniqueId and the
 * in-app dedupe key keep that from doubling), and `capped` sends nothing.
 * The database enforces two per recipient per day. This function does not count in memory.
 */
export async function claimFollowedSellerNewListingAlerts(
  supabase: SupabaseClient,
  input: { listingId: string; recipientIds: readonly string[]; now?: Date },
): Promise<FollowedSellerNewListingAlertClaim[]> {
  const listingId = listingIdSchema.parse(input.listingId)
  const recipientIds = [
    ...new Set(
      input.recipientIds
        .map((id) => id.trim())
        .filter((id) => recipientIdSchema.safeParse(id).success),
    ),
  ]
  if (recipientIds.length === 0) return []

  const dayKey = followedSellerNewListingDayKey(input.now ?? new Date())
  return dbClaimFollowedSellerListingAlerts(supabase, { listingId, recipientIds, dayKey })
}
