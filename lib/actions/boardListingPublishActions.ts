"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { applyPublishedListingSideEffects } from "@/lib/services/publishListingDraft"

const listingIdSchema = z.string().uuid()

export type ApplyBoardListingPublishedSideEffectsResult =
  | { success: true }
  | { error: string }

/**
 * Runs the post-publish side effects (search index sync, Google Merchant,
 * saved-search notifications, cache revalidation) for a board listing the
 * signed-in user just published from the /sell client.
 *
 * The board sell client writes the listing directly via the browser Supabase
 * client, which skips the side effects that `publishListingDraft` and the
 * admin publish APIs apply — without this, a freshly published board is live
 * but missing from search until the next full reindex.
 */
export async function applyBoardListingPublishedSideEffectsAction(
  rawListingId: unknown,
): Promise<ApplyBoardListingPublishedSideEffectsResult> {
  const parsed = listingIdSchema.safeParse(rawListingId)
  if (!parsed.success) {
    return { error: "Invalid listing id." }
  }
  const listingId = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in." }
  }

  try {
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, user_id, status")
      .eq("id", listingId)
      .maybeSingle()

    if (error || !listing) {
      return { error: "Listing not found." }
    }
    if (listing.user_id !== user.id) {
      return { error: "You can only sync your own listings." }
    }
    if (listing.status !== "active") {
      return { error: "Only live listings can be synced." }
    }

    await applyPublishedListingSideEffects(supabase, listingId, user.id)
    return { success: true }
  } catch (error) {
    console.error(
      "applyBoardListingPublishedSideEffectsAction:",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not sync the published listing." }
  }
}
