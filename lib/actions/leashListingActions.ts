"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateListingMutationPaths } from "@/lib/cache/revalidate-listing-mutation-paths"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import {
  createLeashListingSchema,
  updateLeashListingSchema,
} from "@/lib/validations/leash-listing"
import { createLeashListing, updateLeashListing } from "@/lib/services/leashListing"

export type CreateLeashListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateLeashListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a leash listing (a single listings row with section='leashes' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createLeashListingAction(
  raw: unknown,
): Promise<CreateLeashListingActionResult> {
  const parsed = createLeashListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a leash." }
  }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createLeashListing(supabase, user.id, parsed.data)
    revalidateListingMutationPaths("/leashes", result.slug)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createLeashListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your leash listing. Please try again." }
  }
}

/**
 * Updates an existing leash listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateLeashListingAction(
  raw: unknown,
): Promise<UpdateLeashListingActionResult> {
  const parsed = updateLeashListingSchema.safeParse(raw)
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
    const result = await updateLeashListing(supabase, parsed.data.listingId, user.id, parsed.data)
    revalidateListingMutationPaths("/leashes", result.slug)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateLeashListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your leash listing. Please try again.",
    }
  }
}
