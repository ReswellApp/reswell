import { z } from "zod"
import { LISTING_SELLABLE_CONDITIONS } from "@/lib/listing-labels"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { SHOP_PACKAGE_SIZE_IDS } from "@/lib/shop-category-package-sizes"

const listingDeskSpecSchema = z.object({
  brand: z.string().max(80),
  model: z.string().max(120),
  city: z.string().max(80),
  state: z.string().max(40),
  latitude: z.number().finite().nullable(),
  longitude: z.number().finite().nullable(),
  locationDisplay: z.string().max(160),
  localPickup: z.boolean(),
  shippingAvailable: z.boolean(),
  shippingCostMode: z.enum(["reswell", "flat", "free"]),
  shippingPrice: z.string().max(16),
  dropoffLocationId: z.string().max(40),
  packageLengthIn: z.string().max(24),
  packageWidthIn: z.string().max(24),
  packageHeightIn: z.string().max(24),
  packageWeightLb: z.string().max(12),
  packageWeightOz: z.string().max(12),
  boardLength: z.string().max(24),
  boardWidth: z.string().max(24),
  boardThickness: z.string().max(24),
  boardVolume: z.string().max(24),
  finSetup: z.string().max(40),
  finSystem: z.string().max(40),
  construction: z.string().max(40),
  finsIncluded: z.string().max(20),
  tailShape: z.string().max(40),
  finSize: z.string().max(20),
  wetsuitSize: z.string().max(20),
  apparelKind: z.string().max(40),
  tractionSize: z.string().max(40),
})

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
    specs: listingDeskSpecSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.condition !== undefined ||
      value.priceUsd !== undefined ||
      value.packageSizeId !== undefined ||
      value.specs !== undefined,
    { message: "Nothing to save." },
  )

export type ListingQuickEditBody = z.infer<typeof listingQuickEditBodySchema>
