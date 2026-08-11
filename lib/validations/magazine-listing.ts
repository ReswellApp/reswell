import { z } from "zod"
import { magazineListingFixedReswellPackageFormFields } from "@/lib/magazine-listing-config"
import {
  listingRemovedVideoIdsSchema,
  listingVideosFieldSchema,
} from "@/lib/validations/listing-video"

export const MAGAZINE_LISTING_TITLE_MAX_LENGTH = 120
export const MAGAZINE_LISTING_MIN_PHOTOS = 1
export const MAGAZINE_LISTING_MAX_PHOTOS = 12

const sellableConditions = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const

const magazineListingImageSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
})

const magazineListingBaseSchema = z.object({
  title: z.string().trim().min(3, "Add a title").max(MAGAZINE_LISTING_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, "Add a description"),
  price: z.coerce.number().positive("Enter a price greater than $0"),
  condition: z.enum(sellableConditions),
  brand: z.string().trim().min(1, "Add a brand or publisher"),
  year: z.coerce
    .number()
    .int("Enter a whole year")
    .min(1900, "Year must be 1900 or later")
    .max(2100, "Year must be 2100 or earlier"),

  shippingCostMode: z.enum(["reswell", "flat", "free"]).default("reswell"),
  shippingPrice: z.coerce.number().nonnegative().nullable().optional(),

  images: z
    .array(magazineListingImageSchema)
    .min(MAGAZINE_LISTING_MIN_PHOTOS, "Add at least one photo")
    .max(MAGAZINE_LISTING_MAX_PHOTOS),
  videos: listingVideosFieldSchema,
})

const magazineListingUpdateBaseSchema = magazineListingBaseSchema.extend({
  listingId: z.string().uuid(),
  removedImageIds: z.array(z.string().uuid()).optional().default([]),
  removedVideoIds: listingRemovedVideoIdsSchema,
})

const applyMagazineFixedPackageFields = <T extends z.infer<typeof magazineListingBaseSchema>>(
  data: T,
) => ({
  ...data,
  shippingCostMode: "reswell" as const,
  ...magazineListingFixedReswellPackageFormFields(),
})

export const createMagazineListingSchema = magazineListingBaseSchema.transform(
  applyMagazineFixedPackageFields,
)

export type CreateMagazineListingInput = z.infer<typeof createMagazineListingSchema>

export const updateMagazineListingSchema = magazineListingUpdateBaseSchema.transform(
  applyMagazineFixedPackageFields,
)

export type UpdateMagazineListingInput = z.infer<typeof updateMagazineListingSchema>
