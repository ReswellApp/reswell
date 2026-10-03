import { z } from "zod"
import { LISTING_SELLABLE_CONDITIONS } from "@/lib/listing-labels"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { SHOP_PACKAGE_SIZE_IDS } from "@/lib/shop-category-package-sizes"

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

export const LISTING_QUICK_EDIT_DESCRIPTION_MAX = 5000

export const listingQuickEditBodySchema = z
  .object({
    listingId: z.string().uuid(),
    title: z.string().trim().min(1, "Add a title.").max(LISTING_TITLE_MAX_LENGTH).optional(),
    description: z.string().max(LISTING_QUICK_EDIT_DESCRIPTION_MAX).optional(),
    condition: z.enum(LISTING_SELLABLE_CONDITIONS).optional(),
    priceUsd: z.number().min(PRICE_MIN).max(PRICE_MAX).optional(),
    packageSizeId: z.enum(SHOP_PACKAGE_SIZE_IDS).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.condition !== undefined ||
      value.priceUsd !== undefined ||
      value.packageSizeId !== undefined,
    { message: "Nothing to save." },
  )

export type ListingQuickEditBody = z.infer<typeof listingQuickEditBodySchema>
