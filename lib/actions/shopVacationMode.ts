"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { setShopVacationModeForSeller } from "@/lib/services/shopVacationMode"
import { shopVacationModeBodySchema } from "@/lib/validations/shop-vacation-mode"

export type SetShopVacationModeActionResult =
  | { success: true; vacationMode: boolean; updated: number; failed: number }
  | { error: string }

export async function setShopVacationModeAction(
  raw: unknown,
): Promise<SetShopVacationModeActionResult> {
  const parsed = shopVacationModeBodySchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid request." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in to update your shop." }

  try {
    const result = await setShopVacationModeForSeller({
      supabase,
      userId: user.id,
      vacationMode: parsed.data.vacationMode,
    })
    if (!result.ok) return { error: result.error }
    revalidatePath("/dashboard/listings")
    return {
      success: true,
      vacationMode: result.vacationMode,
      updated: result.updated,
      failed: result.failed,
    }
  } catch (error) {
    console.error(
      "[setShopVacationModeAction]",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not update vacation mode." }
  }
}
