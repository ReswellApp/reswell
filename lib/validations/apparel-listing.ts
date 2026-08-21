import { z } from "zod"
import { addReswellPackedWeightZodIssues } from "@/lib/validations/reswell-packed-weight"
import {
  listingRemovedVideoIdsSchema,
  listingVideosFieldSchema,
} from "@/lib/validations/listing-video"
import { APPAREL_KIND_OPTIONS, APPAREL_SIZE_OPTIONS } from "@/lib/apparel-listing-config"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"

export const APPAREL_LISTING_TITLE_MAX_LENGTH = 60
export const APPAREL_LISTING_MIN_PHOTOS = 1
export const APPAREL_LISTING_MAX_PHOTOS = 12

const apparelKindValues = APPAREL_KIND_OPTIONS.map((o) => o.value) as [string, ...string[]]
const apparelSizeValues = APPAREL_SIZE_OPTIONS.map((o) => o.value)

const sellableConditions = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const

const optionalSlug = (values: readonly string[]) =>
  z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "" || values.includes(v), {
      message: "Invalid option",
    })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()

const apparelListingImageSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
})

const apparelListingBaseSchema = z.object({
  title: z.string().trim().min(3, "Add a title").max(APPAREL_LISTING_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, "Add a description"),
  price: z.coerce.number().positive("Enter a price greater than $0"),
  condition: z.enum(sellableConditions),

  /** Apparel category — boardshorts | hat | t_shirt. Required. */
  kind: z.enum(apparelKindValues, { required_error: "Choose a category" }),

  size: optionalSlug(apparelSizeValues),

  brand: z.string().trim().max(120).optional().default(""),
  brandId: z.string().uuid().nullable().optional(),
  model: z.string().trim().max(200).optional().default(""),
  brandModelId: z.string().uuid().nullable().optional(),

  locationCity: z.string().trim().min(1, "Add your location"),
  locationState: z.string().trim().min(1, "Add your location"),
  locationLat: z.coerce.number().optional(),
  locationLng: z.coerce.number().optional(),

  shippingAvailable: z.boolean().default(false),
  localPickup: z.boolean().default(true),
  shippingCostMode: z.enum(["reswell", "flat", "free"]).nullable().optional(),
  shippingPrice: z.coerce.number().nonnegative().nullable().optional(),
  reswellPackageLengthIn: z.string().optional().default(""),
  reswellPackageWidthIn: z.string().optional().default(""),
  reswellPackageHeightIn: z.string().optional().default(""),
  reswellPackageWeightLb: z.string().optional().default(""),
  reswellPackageWeightOz: z.string().optional().default(""),

  buyerOffers: z.boolean().default(true),
  sellerPurchasePrice: z.coerce.number().nonnegative().nullable().optional(),

  images: z
    .array(apparelListingImageSchema)
    .min(APPAREL_LISTING_MIN_PHOTOS, "Add at least one photo")
    .max(APPAREL_LISTING_MAX_PHOTOS),
  videos: listingVideosFieldSchema,
})

function withApparelListingRefinements<T extends z.ZodType>(schema: T) {
  return schema
    .refine((data) => data.shippingAvailable || data.localPickup, {
      message: "Choose shipping, local pickup, or both",
      path: ["localPickup"],
    })
    .superRefine((data, ctx) => {
      if (!data.shippingAvailable) return

      const L = parseReswellParcelLengthRawToCarrierInches(data.reswellPackageLengthIn)
      if (L == null || L <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter packed box length in inches.",
          path: ["reswellPackageLengthIn"],
        })
      }
      const W = parseReswellParcelWidthHeightRawToCarrierInches(data.reswellPackageWidthIn)
      if (W == null || W <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter packed box width in inches.",
          path: ["reswellPackageWidthIn"],
        })
      }
      const H = parseReswellParcelWidthHeightRawToCarrierInches(data.reswellPackageHeightIn)
      if (H == null || H <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter packed box height in inches.",
          path: ["reswellPackageHeightIn"],
        })
      }

      addReswellPackedWeightZodIssues(data.reswellPackageWeightLb, data.reswellPackageWeightOz, ctx)
    })
}

const apparelListingUpdateBaseSchema = apparelListingBaseSchema.extend({
  listingId: z.string().uuid(),
  removedImageIds: z.array(z.string().uuid()).optional().default([]),
  removedVideoIds: listingRemovedVideoIdsSchema,
})

export const createApparelListingSchema = withApparelListingRefinements(apparelListingBaseSchema)

// Inferred from the base object schema (refinements don't change the data shape),
// which keeps inference precise — inferring through the refined ZodEffects widens to `any`.
export type CreateApparelListingInput = z.infer<typeof apparelListingBaseSchema>

export const updateApparelListingSchema = withApparelListingRefinements(apparelListingUpdateBaseSchema)

export type UpdateApparelListingInput = z.infer<typeof apparelListingUpdateBaseSchema>
