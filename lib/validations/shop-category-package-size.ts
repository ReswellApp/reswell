import { z } from "zod"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"
import {
  isShopPackageSizeAllowed,
  isShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"

export const setShopCategoryPackageSizeSchema = z
  .object({
    section: z.enum(PEER_LISTING_SECTIONS),
    packageSizeId: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    if (!isShopPackageSizeId(value.packageSizeId) || !isShopPackageSizeAllowed(value.section, value.packageSizeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "That package size is not available for this category.",
        path: ["packageSizeId"],
      })
    }
  })

export type SetShopCategoryPackageSizeInput = z.infer<typeof setShopCategoryPackageSizeSchema>
