"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import {
  createApparelListingSchema,
  updateApparelListingSchema,
} from "@/lib/validations/apparel-listing"
import { createApparelListing, updateApparelListing } from "@/lib/services/apparelListing"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"

export type CreateApparelListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateApparelListingActionResult =
  | { success: true; slug: string }
  | { error: string }

async function assertCanSellApparel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  if (!APPAREL_SELL_ADMIN_ONLY) return null
  const isAdmin = await fetchProfileIsAdmin(supabase, userId)
  if (!isAdmin) {
    return "Apparel listings are not open to the public yet."
  }
  return null
}

/**
 * Creates a apparel listing (a single listings row with section='apparel' plus
 * listing_images). Photos must already be uploaded to storage client-side; the
 * action persists their URLs. Authenticates and validates server-side.
 */
export async function createApparelListingAction(
  raw: unknown,
): Promise<CreateApparelListingActionResult> {
  const parsed = createApparelListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list apparel." }
  }

  const gateError = await assertCanSellApparel(supabase, user.id)
  if (gateError) return { error: gateError }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createApparelListing(supabase, user.id, parsed.data)
    void trackFirstTimeSellerForListingIfNeeded(supabase, {
      listingId: result.listingId,
      sellerUserId: user.id,
      sellerEmail: user.email ?? null,
    })
    revalidatePath("/apparel")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createApparelListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your apparel listing. Please try again." }
  }
}

/**
 * Updates an existing apparel listing owned by the signed-in user. Admins editing
 * another seller's listing should use the impersonation API from the sell UI.
 */
export async function updateApparelListingAction(
  raw: unknown,
): Promise<UpdateApparelListingActionResult> {
  const parsed = updateApparelListingSchema.safeParse(raw)
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

  const gateError = await assertCanSellApparel(supabase, user.id)
  if (gateError) return { error: gateError }

  try {
    const result = await updateApparelListing(supabase, parsed.data.listingId, user.id, parsed.data)
    revalidatePath("/apparel")
    revalidatePath(`/l/${result.slug}`)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateApparelListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your apparel listing. Please try again.",
    }
  }
}
