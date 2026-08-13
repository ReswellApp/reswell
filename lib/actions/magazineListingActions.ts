"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateListingMutationPaths } from "@/lib/cache/revalidate-listing-mutation-paths"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import {
  createMagazineListingSchema,
  updateMagazineListingSchema,
} from "@/lib/validations/magazine-listing"
import { createMagazineListing, updateMagazineListing } from "@/lib/services/magazineListing"
import { trackFirstTimeSellerForListingIfNeeded } from "@/lib/services/klaviyoFirstTimeSeller"

export type CreateMagazineListingActionResult =
  | { success: true; listingId: string; slug: string }
  | { error: string }

export type UpdateMagazineListingActionResult = { success: true; slug: string } | { error: string }

export async function createMagazineListingAction(
  raw: unknown,
): Promise<CreateMagazineListingActionResult> {
  const parsed = createMagazineListingSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Please check the form and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to list a magazine." }
  }


  const sellGuard = await evaluateSellerCanSell(supabase, user.id)
  if (!sellGuard.ok) {
    return { error: sellGuard.userMessage }
  }

  try {
    const result = await createMagazineListing(supabase, user.id, parsed.data)
    void trackFirstTimeSellerForListingIfNeeded(supabase, {
      listingId: result.listingId,
      sellerUserId: user.id,
      sellerEmail: user.email ?? null,
    })
    revalidateListingMutationPaths("/magazines", result.slug)
    return { success: true, listingId: result.listingId, slug: result.slug }
  } catch (error) {
    console.error("createMagazineListingAction:", error instanceof Error ? error.message : error)
    return { error: "We couldn't publish your magazine listing. Please try again." }
  }
}

export async function updateMagazineListingAction(
  raw: unknown,
): Promise<UpdateMagazineListingActionResult> {
  const parsed = updateMagazineListingSchema.safeParse(raw)
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
    const result = await updateMagazineListing(
      supabase,
      parsed.data.listingId,
      user.id,
      parsed.data,
    )
    revalidateListingMutationPaths("/magazines", result.slug)
    return { success: true, slug: result.slug }
  } catch (error) {
    console.error("updateMagazineListingAction:", error instanceof Error ? error.message : error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "We couldn't save your magazine listing. Please try again.",
    }
  }
}
