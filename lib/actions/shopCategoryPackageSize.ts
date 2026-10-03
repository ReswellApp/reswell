"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { setShopCategoryPackageSizeForSeller } from "@/lib/services/shopCategoryPackageSize"
import type { ListingPackageColumns, ShopCategoryPackageSizeMap } from "@/lib/shop-category-package-sizes"
import { setShopCategoryPackageSizeSchema } from "@/lib/validations/shop-category-package-size"

export type SetShopCategoryPackageSizeActionResult =
  | {
      success: true
      sizes: ShopCategoryPackageSizeMap
      updatedCount: number
      columns: ListingPackageColumns
      section: string
    }
  | { error: string }

export async function setShopCategoryPackageSizeAction(
  raw: unknown,
): Promise<SetShopCategoryPackageSizeActionResult> {
  const parsed = setShopCategoryPackageSizeSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid package size." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Please sign in to update your shop." }

  try {
    const result = await setShopCategoryPackageSizeForSeller({
      supabase,
      userId: user.id,
      section: parsed.data.section,
      packageSizeId: parsed.data.packageSizeId,
    })
    if (!result.ok) return { error: result.error }
    revalidatePath("/dashboard/listings")
    return {
      success: true,
      sizes: result.sizes,
      updatedCount: result.updatedCount,
      columns: result.columns,
      section: parsed.data.section,
    }
  } catch (error) {
    console.error(
      "[setShopCategoryPackageSizeAction]",
      error instanceof Error ? error.message : error,
    )
    return { error: "Could not save this package size." }
  }
}
