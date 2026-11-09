"use server"

import { revalidatePath } from "next/cache"
import { resolveManagedSeller } from "@/lib/account-access/managed-seller"
import { createClient } from "@/lib/supabase/server"
import {
  loadShopVacationListingsForSeller,
  setShopVacationModeForSeller,
} from "@/lib/services/shopVacationMode"
import type { ShopVacationListing } from "@/lib/shop-vacation"
import { shopVacationModeBodySchema } from "@/lib/validations/shop-vacation-mode"

export type SetShopVacationModeActionResult =
  | { success: true; vacationMode: boolean; updated: number; failed: number }
  | { error: string }

export type GetShopVacationStatusActionResult =
  | { success: true; listings: ShopVacationListing[] }
  | { error: string }

export async function getShopVacationStatusAction(): Promise<GetShopVacationStatusActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in to manage your shop." }

  const managed = await resolveManagedSeller("listings.write")
  if (!managed.ok) return { error: managed.error }

  const loaded = await loadShopVacationListingsForSeller(supabase, managed.seller.sellerId)
  if (!loaded.ok) return { error: loaded.error }
  return { success: true, listings: loaded.listings }
}

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

  const managed = await resolveManagedSeller("listings.write")
  if (!managed.ok) return { error: managed.error }

  try {
    const result = await setShopVacationModeForSeller({
      supabase,
      userId: managed.seller.sellerId,
      vacationMode: parsed.data.vacationMode,
    })
    if (!result.ok) return { error: result.error }
    revalidatePath("/dashboard/listings")
    revalidatePath("/dashboard/profile")
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
