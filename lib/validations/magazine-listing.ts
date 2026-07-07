import { z } from "zod"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"

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
  reswellPackageLengthIn: z.string().optional().default(""),
  reswellPackageWidthIn: z.string().optional().default(""),
  reswellPackageHeightIn: z.string().optional().default(""),
  reswellPackageWeightLb: z.string().optional().default(""),
  reswellPackageWeightOz: z.string().optional().default(""),

  images: z
    .array(magazineListingImageSchema)
    .min(MAGAZINE_LISTING_MIN_PHOTOS, "Add at least one photo")
    .max(MAGAZINE_LISTING_MAX_PHOTOS),
})

function withMagazineListingRefinements<T extends z.ZodType>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const mode = data.shippingCostMode ?? "reswell"
    if (mode !== "reswell") return

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

    const lbRaw = data.reswellPackageWeightLb?.trim() ?? ""
    const ozRaw = data.reswellPackageWeightOz?.trim() ?? ""
    const lb = lbRaw === "" ? 0 : parseFloat(lbRaw.replace(/,/g, ""))
    const oz = ozRaw === "" ? 0 : parseFloat(ozRaw.replace(/,/g, ""))
    if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid packed weight, or leave both fields blank.",
        path: ["reswellPackageWeightLb"],
      })
      return
    }
    if (oz >= 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ounces must be under 16.",
        path: ["reswellPackageWeightOz"],
      })
      return
    }
    if (lbRaw !== "" || ozRaw !== "") {
      const totalOz = lb * 16 + oz
      if (!Number.isFinite(totalOz) || totalOz <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a positive packed weight, or leave both fields blank.",
          path: ["reswellPackageWeightLb"],
        })
      }
    }
  })
}

const magazineListingUpdateBaseSchema = magazineListingBaseSchema.extend({
  listingId: z.string().uuid(),
  removedImageIds: z.array(z.string().uuid()).optional().default([]),
})

export const createMagazineListingSchema = withMagazineListingRefinements(magazineListingBaseSchema)

export type CreateMagazineListingInput = z.infer<typeof magazineListingBaseSchema>

export const updateMagazineListingSchema = withMagazineListingRefinements(magazineListingUpdateBaseSchema)

export type UpdateMagazineListingInput = z.infer<typeof magazineListingUpdateBaseSchema>
