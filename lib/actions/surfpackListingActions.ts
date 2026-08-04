"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import {
  createSurfpackListingSchema,
  updateSurfpackListingSchema,
} from "@/lib/validations/surfpack-listing"
import { createSurfpackListing, updateSurfpackListing } from "@/lib/services/surfpackListing"

export type CreateSurfpackListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateSurfpackListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a surfpack listing (a single listings row with section='surfpacks' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createSurfpackListingAction(
  raw: unknown,
): Promise<CreateSurfpackListingActionResult> {
  const parsed = createSurfpackListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a surfpack." }
  }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createSurfpackListing(supabase, user.id, parsed.data)
    revalidatePath("/surfpacks")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createSurfpackListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your surfpack listing. Please try again." }
  }
}

/**
 * Updates an existing surfpack listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateSurfpackListingAction(
  raw: unknown,
): Promise<UpdateSurfpackListingActionResult> {
  const parsed = updateSurfpackListingSchema.safeParse(raw)
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
    const result = await updateSurfpackListing(supabase, parsed.data.listingId, user.id, parsed.data)
    revalidatePath("/surfpacks")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateSurfpackListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your surfpack listing. Please try again.",
    }
  }
}
