"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  createBoardbagListingSchema,
  updateBoardbagListingSchema,
} from "@/lib/validations/boardbag-listing"
import { createBoardbagListing, updateBoardbagListing } from "@/lib/services/boardbagListing"

export type CreateBoardbagListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateBoardbagListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a boardbag listing (a single listings row with section='boardbags' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createBoardbagListingAction(
  raw: unknown,
): Promise<CreateBoardbagListingActionResult> {
  const parsed = createBoardbagListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a boardbag." }
  }

  try {
    const result = await createBoardbagListing(supabase, user.id, parsed.data)
    revalidatePath("/boardbags")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createBoardbagListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your boardbag listing. Please try again." }
  }
}

/**
 * Updates an existing boardbag listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateBoardbagListingAction(
  raw: unknown,
): Promise<UpdateBoardbagListingActionResult> {
  const parsed = updateBoardbagListingSchema.safeParse(raw)
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
    const result = await updateBoardbagListing(supabase, parsed.data.listingId, user.id, parsed.data)
    revalidatePath("/boardbags")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateBoardbagListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your boardbag listing. Please try again.",
    }
  }
}
