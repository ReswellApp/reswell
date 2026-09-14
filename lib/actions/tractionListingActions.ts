"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateListingMutationPaths } from "@/lib/cache/revalidate-listing-mutation-paths"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import {
  createTractionListingSchema,
  updateTractionListingSchema,
} from "@/lib/validations/traction-listing"
import { createTractionListing, updateTractionListing } from "@/lib/services/tractionListing"

export type CreateTractionListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateTractionListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a traction listing (a single listings row with section='traction' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createTractionListingAction(
  raw: unknown,
): Promise<CreateTractionListingActionResult> {
  const parsed = createTractionListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list traction." }
  }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createTractionListing(supabase, user.id, parsed.data)
    revalidateListingMutationPaths("/traction", result.slug)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createTractionListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your traction listing. Please try again." }
  }
}

/**
 * Updates an existing traction listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateTractionListingAction(
  raw: unknown,
): Promise<UpdateTractionListingActionResult> {
  const parsed = updateTractionListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to edit this listing." }
  }

  try {
    const result = await updateTractionListing(supabase, parsed.data.listingId, user.id, parsed.data)
    revalidateListingMutationPaths("/traction", result.slug)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateTractionListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your traction listing. Please try again.",
    }
  }
}
