"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateListingMutationPaths } from "@/lib/cache/revalidate-listing-mutation-paths"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import {
  createAccessoryListingSchema,
  updateAccessoryListingSchema,
} from "@/lib/validations/accessory-listing"
import { createAccessoryListing, updateAccessoryListing } from "@/lib/services/accessoryListing"

export type CreateAccessoryListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateAccessoryListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a accessory listing (a single listings row with section='accessories' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createAccessoryListingAction(
  raw: unknown,
): Promise<CreateAccessoryListingActionResult> {
  const parsed = createAccessoryListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a accessory." }
  }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createAccessoryListing(supabase, user.id, parsed.data)
    revalidateListingMutationPaths("/accessories", result.slug)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createAccessoryListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your accessory listing. Please try again." }
  }
}

/**
 * Updates an existing accessory listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateAccessoryListingAction(
  raw: unknown,
): Promise<UpdateAccessoryListingActionResult> {
  const parsed = updateAccessoryListingSchema.safeParse(raw)
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
    const result = await updateAccessoryListing(supabase, parsed.data.listingId, user.id, parsed.data)
    revalidateListingMutationPaths("/accessories", result.slug)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateAccessoryListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your accessory listing. Please try again.",
    }
  }
}
