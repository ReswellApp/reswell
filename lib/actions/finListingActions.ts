"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createFinListingSchema, updateFinListingSchema } from "@/lib/validations/fin-listing"
import { createFinListing, updateFinListing } from "@/lib/services/finListing"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"

export type CreateFinListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateFinListingActionResult =
  | { success: true; slug: string }
  | { error: string }

/**
 * Creates a fin listing (a single listings row with section='fins' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createFinListingAction(
  raw: unknown,
): Promise<CreateFinListingActionResult> {
  const parsed = createFinListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a fin." }
  }

  try {
    const result = await createFinListing(supabase, user.id, parsed.data)
    void syncListingToGoogleMerchantBestEffort(supabase, result.listingId)
    revalidatePath("/fins")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createFinListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your fin listing. Please try again." }
  }
}

/**
 * Updates an existing fin listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateFinListingAction(
  raw: unknown,
): Promise<UpdateFinListingActionResult> {
  const parsed = updateFinListingSchema.safeParse(raw)
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
    const result = await updateFinListing(supabase, parsed.data.listingId, user.id, parsed.data)
    void syncListingToGoogleMerchantBestEffort(supabase, parsed.data.listingId)
    revalidatePath("/fins")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateFinListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error ? error.message : "We couldn't save your fin listing. Please try again.",
    }
  }
}
