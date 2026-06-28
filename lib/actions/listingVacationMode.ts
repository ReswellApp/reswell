"use server"

import { revalidatePath } from "next/cache"
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

  const result = await setListingVacationModeForSeller({
    supabase,
    userId: user.id,
    listingId: parsed.data.listingId,
    vacationMode: parsed.data.vacationMode,
  })

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath("/dashboard/listings")
  return { success: true, vacationMode: parsed.data.vacationMode }
}
