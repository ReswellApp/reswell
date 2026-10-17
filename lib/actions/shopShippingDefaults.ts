"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { fetchListingsDeskProfile } from "@/lib/db/shopCategoryPackageSizes"
import { saveShopShippingDefaultsForSeller } from "@/lib/services/shopShippingDefaults"
import type { ListingPackageColumns } from "@/lib/shop-category-package-sizes"
import type { ShopShippingDefaults } from "@/lib/shop-shipping-defaults"
import { saveShopShippingDefaultsSchema } from "@/lib/validations/shop-shipping-defaults"

export type SaveShopShippingDefaultsActionResult =
  | {
      success: true
      defaults: ShopShippingDefaults
      updatedCount: number
      appliedGroups: { ids: string[]; columns: ListingPackageColumns }[]
      skippedBecausePackageDoesNotFit: number
    }
  | { error: string }

export async function saveShopShippingDefaultsAction(
  raw: unknown,
): Promise<SaveShopShippingDefaultsActionResult> {
  const parsed = saveShopShippingDefaultsSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the shop shipping default and try again." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in to update your shop." }

  try {
    const profile = await fetchListingsDeskProfile(supabase, user.id)
    const result = await saveShopShippingDefaultsForSeller({
      supabase,
      userId: user.id,
      draft: parsed.data,
      categoryPresets: profile.shopCategoryPackageSizes,
    })
    if (!result.ok) return { error: result.error }
    revalidatePath("/dashboard/listings")
    return {
      success: true,
      defaults: result.defaults,
      updatedCount: result.updatedCount,
      appliedGroups: result.appliedGroups,
      skippedBecausePackageDoesNotFit: result.skippedBecausePackageDoesNotFit,
    }
  } catch (error) {
    console.error(
      "[saveShopShippingDefaultsAction]",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not save your shop shipping default." }
  }
}
