import { z } from "zod"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { isListingSellableCondition } from "@/lib/listing-labels"

const fbMarketplaceUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid Facebook Marketplace link.")
  .refine(
    (url) => /facebook\.com\/marketplace\/item\/\d+/i.test(url),
    "Link must be a Facebook Marketplace item URL (facebook.com/marketplace/item/…).",
  )

export const fbMarketplacePreviewBodySchema = z.object({
  url: fbMarketplaceUrlSchema,
})

export const fbMarketplacePublishBodySchema = z.object({
  sourceUrl: z
    .string()
    .trim()
    .min(1, "Source URL is required.")
    .url("Enter a valid URL."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(LISTING_TITLE_MAX_LENGTH, `Title must be ${LISTING_TITLE_MAX_LENGTH} characters or fewer.`),
  price: z.coerce
    .number()
    .positive("Enter a valid price.")
    .max(999_999.99, "Price is too high."),
  description: z.string().trim().max(10_000).optional().default(""),
  brand: z.string().trim().max(120).optional().default(""),
  model: z.string().trim().max(200).optional().default(""),
  dimensions: z.string().trim().max(120).optional().default(""),
  condition: z
    .string()
    .trim()
    .refine(isListingSellableCondition, "Select a condition."),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(1, "State is required."),
  importedImageUrls: z.array(z.string().url()).max(12).default([]),
  uploadedImages: z
    .array(
      z.object({
        url: z.string().url(),
        thumbnail_url: z.string().url().nullable().optional(),
      }),
    )
    .max(12)
    .default([]),
})

export type FbMarketplaceImportPreview = {
  sourceUrl: string
  listingId: string
  title: string
  price: number | null
  description: string
  brand: string
  model: string
  dimensions: string
  condition: string
  city: string
  state: string
  imageUrls: string[]
  warnings: string[]
}
