import { addReswellPackedWeightZodIssues } from "@/lib/validations/reswell-packed-weight"
import {
  listingRemovedVideoIdsSchema,
  listingVideosFieldSchema,
} from "@/lib/validations/listing-video"
import { z } from "zod"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
} from "@/lib/fin-listing-config"
import {
  applyFinReswellPackageDefaults,
  finReswellPackageHasPartialDimensions,
} from "@/lib/fin-reswell-shipping-defaults"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import { RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN } from "@/lib/surfboard-shipping-estimates"

export const FIN_LISTING_TITLE_MAX_LENGTH = 60
export const FIN_LISTING_MIN_PHOTOS = 1
export const FIN_LISTING_MAX_PHOTOS = 12

const finSetupValues = FIN_SETUP_OPTIONS.map((o) => o.value) as [string, ...string[]]
const finSystemValues = FIN_SYSTEM_OPTIONS_FOR_FINS.map((o) => o.value) as [string, ...string[]]
const finSizeValues = FIN_SIZE_OPTIONS.map((o) => o.value) as [string, ...string[]]

const sellableConditions = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const

const optionalSlug = (values: readonly [string, ...string[]]) =>
  z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => v === "" || (values as readonly string[]).includes(v), {
      message: "Invalid option",
    })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()

const finListingImageSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
})

const finListingBaseObject = z.object({
  title: z.string().trim().min(3, "Add a title").max(FIN_LISTING_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1, "Add a description"),
  price: z.coerce.number().positive("Enter a price greater than $0"),
  condition: z.enum(sellableConditions),

  size: optionalSlug(finSizeValues),
  finSetup: optionalSlug(finSetupValues),
  finSystem: optionalSlug(finSystemValues),

  brand: z.string().trim().max(120).optional().default(""),
  brandId: z.string().uuid().nullable().optional(),
  model: z.string().trim().max(200).optional().default(""),
  brandModelId: z.string().uuid().nullable().optional(),

  locationCity: z.string().trim().min(1, "Add your location"),
  locationState: z.string().trim().min(1, "Add your location"),
  locationLat: z.coerce.number().optional(),
  locationLng: z.coerce.number().optional(),

  shippingAvailable: z.boolean().default(true),
  localPickup: z.boolean().default(false),
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
    .array(finListingImageSchema)
    .min(FIN_LISTING_MIN_PHOTOS, "Add at least one photo")
    .max(FIN_LISTING_MAX_PHOTOS),
  videos: listingVideosFieldSchema,
})

function withFinReswellPackageDefaultsTransform<T extends z.ZodTypeAny>(schema: T) {
  return schema.transform((data) => {
    if ((data.shippingCostMode ?? "reswell") !== "reswell") return data
    return {
      ...data,
      ...applyFinReswellPackageDefaults({
        reswellPackageLengthIn: data.reswellPackageLengthIn ?? "",
        reswellPackageWidthIn: data.reswellPackageWidthIn ?? "",
        reswellPackageHeightIn: data.reswellPackageHeightIn ?? "",
        reswellPackageWeightLb: data.reswellPackageWeightLb ?? "",
        reswellPackageWeightOz: data.reswellPackageWeightOz ?? "",
      }),
    }
  })
}

function withFinListingRefinements<T extends z.ZodType>(schema: T) {
  return schema
    .refine((data) => data.shippingAvailable && !data.localPickup, {
      message: "Fin listings must ship — local pickup is not available",
      path: ["shippingAvailable"],
    })
    .superRefine((data, ctx) => {
      if (!data.shippingAvailable) return
      const mode = data.shippingCostMode ?? "reswell"
      if (mode !== "reswell") return

      if (finReswellPackageHasPartialDimensions(data)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter all packed box dimensions, or leave them all blank to use our fin defaults.",
          path: ["reswellPackageLengthIn"],
        })
        return
      }

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
      if (L != null && L > RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Packed length for fins must be ${RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN} inches or less.`,
          path: ["reswellPackageLengthIn"],
        })
      }

      addReswellPackedWeightZodIssues(data.reswellPackageWeightLb, data.reswellPackageWeightOz, ctx)
    })
}

export const createFinListingSchema = withFinListingRefinements(
  withFinReswellPackageDefaultsTransform(finListingBaseObject),
)

export type CreateFinListingInput = z.infer<typeof createFinListingSchema>

export const updateFinListingSchema = withFinListingRefinements(
  withFinReswellPackageDefaultsTransform(
    finListingBaseObject.extend({
      listingId: z.string().uuid(),
      removedImageIds: z.array(z.string().uuid()).optional().default([]),
      removedVideoIds: listingRemovedVideoIdsSchema,
    }),
  ),
)

export type UpdateFinListingInput = z.infer<typeof updateFinListingSchema>
