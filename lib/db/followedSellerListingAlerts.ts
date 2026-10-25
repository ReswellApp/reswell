import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const claimRowSchema = z.object({
  recipient_id: z.string().uuid(),
  status: z.enum(["granted", "already_granted", "capped"]),
})

export interface FollowedSellerListingAlertGrantRow {
  recipientId: string
  status: "granted" | "already_granted" | "capped"
}

/**
 * Atomic cap claim. One database transaction locks each follower, so concurrent
 * publishes cannot both take the last slot. Empty input does not call Postgres.
 */
export async function dbClaimFollowedSellerListingAlerts(
  supabase: SupabaseClient,
  input: { listingId: string; recipientIds: string[]; dayKey: string },
): Promise<FollowedSellerListingAlertGrantRow[]> {
  if (input.recipientIds.length === 0) return []

  const { data, error } = await supabase.rpc("claim_followed_seller_listing_alerts", {
    p_listing_id: input.listingId,
    p_recipient_ids: input.recipientIds,
    p_day_key: input.dayKey,
  })
  if (error) {
    throw new Error(`followed seller listing cap claim failed: ${error.message}`)
  }

  const parsed = z.array(claimRowSchema).safeParse(data ?? [])
  if (!parsed.success) {
    throw new Error("followed seller listing cap claim returned an unexpected payload")
  }
  if (parsed.data.length !== input.recipientIds.length) {
    throw new Error("followed seller listing cap claim returned an incomplete set")
  }

  return parsed.data.map((row) => ({
    recipientId: row.recipient_id,
    status: row.status,
  }))
}
