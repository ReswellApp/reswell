"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { updateSellerListingQuickEdit, type ListingQuickEditSaved } from "@/lib/services/listingQuickEdit"

export type { ListingQuickEditSaved }
import { listingQuickEditBodySchema } from "@/lib/validations/listing-quick-edit"

export type ListingQuickEditActionResult =
  | { success: true; listing: ListingQuickEditSaved }
  | { error: string }

export async function updateListingQuickEditAction(
  raw: unknown,
): Promise<ListingQuickEditActionResult> {
  const parsed = listingQuickEditBodySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid listing update." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in to update this listing." }

  try {
    const result = await updateSellerListingQuickEdit(supabase, {
      sellerUserId: user.id,
      ...parsed.data,
    })
    if (!result.ok) return { error: result.error }
    revalidatePath("/dashboard/listings")
    return { success: true, listing: result.listing }
  } catch (error) {
    console.error(
      "[updateListingQuickEditAction]",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not save this listing." }
  }
}
