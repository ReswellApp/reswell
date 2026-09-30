"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { updateSellerListingAcquisition } from "@/lib/services/sellerBalanceSheet"
import { updateListingAcquisitionSchema } from "@/lib/validations/listing-acquisition"

export type UpdateListingAcquisitionActionResult =
  | { success: true }
  | { error: string }

export async function updateListingAcquisitionAction(
  raw: unknown,
): Promise<UpdateListingAcquisitionActionResult> {
  const parsed = updateListingAcquisitionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase details." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Please sign in to update this listing." }
  }

  try {
    const updated = await updateSellerListingAcquisition(supabase, user.id, parsed.data)
    if (!updated) {
      return { error: "You do not have permission to update this listing." }
    }
  } catch (error) {
    console.error("[sellerBalanceSheet] acquisition update failed", {
      userId: user.id,
      listingId: parsed.data.listingId,
      error,
      timestamp: new Date().toISOString(),
    })
    return { error: "Could not save purchase details. Please try again." }
  }

  revalidatePath("/dashboard/balance-sheet")
  return { success: true }
}
