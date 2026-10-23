"use server"

import { revalidatePath } from "next/cache"
import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { createClient } from "@/lib/supabase/server"
import { setListingVacationModeForSeller } from "@/lib/services/listingVacationMode"
import { listingVacationModeBodySchema } from "@/lib/validations/listing-vacation-mode"

export type SetListingVacationModeActionResult =
  | { success: true; vacationMode: boolean }
  | { error: string }

export async function setListingVacationModeAction(
  raw: unknown,
): Promise<SetListingVacationModeActionResult> {
  const parsed = listingVacationModeBodySchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first?.message ?? "Invalid request" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Please sign in to update this listing." }
  }

  const managed = await resolveManagedSeller("listings.write")
  if (!managed.ok) return { error: managed.error }

  const result = await setListingVacationModeForSeller({
    supabase,
    userId: managed.seller.sellerId,
    listingId: parsed.data.listingId,
    vacationMode: parsed.data.vacationMode,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath("/dashboard/listings")
  return { success: true, vacationMode: parsed.data.vacationMode }
}
