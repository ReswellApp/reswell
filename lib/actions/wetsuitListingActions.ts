"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  createWetsuitListingSchema,
  updateWetsuitListingSchema,
} from "@/lib/validations/wetsuit-listing"
import { createWetsuitListing, updateWetsuitListing } from "@/lib/services/wetsuitListing"

export type CreateWetsuitListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateWetsuitListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a wetsuit listing (a single listings row with section='wetsuits' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createWetsuitListingAction(
  raw: unknown,
): Promise<CreateWetsuitListingActionResult> {
  const parsed = createWetsuitListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a wetsuit." }
  }

  try {
    const result = await createWetsuitListing(supabase, user.id, parsed.data)
    revalidatePath("/wetsuits")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createWetsuitListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your wetsuit listing. Please try again." }
  }
}

/**
 * Updates an existing wetsuit listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateWetsuitListingAction(
  raw: unknown,
): Promise<UpdateWetsuitListingActionResult> {
  const parsed = updateWetsuitListingSchema.safeParse(raw)
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
    const result = await updateWetsuitListing(
      supabase,
      parsed.data.listingId,
      user.id,
      parsed.data,
    )
    revalidatePath("/wetsuits")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateWetsuitListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your wetsuit listing. Please try again.",
    }
  }
}
