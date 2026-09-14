import { z } from "zod"

export const listingBrandModelResearchConfidenceSchema = z.enum(["high", "low"])

export const listingBrandModelResearchSkipReasonSchema = z.enum([
  "unclear",
  "invented",
  "custom_or_one_off",
  "not_a_shaper",
  "wrong_category",
  "retailer_or_marketplace",
  "social_only",
  "no_official_site",
  "no_named_model",
])

/**
 * Structured research result for a live listing that is missing a catalog brand
 * and/or model. The model must not invent a brand or model the listing did not
 * reference, and must not treat retailer/social pages as official sources.
 */
export const listingBrandModelResearchResultSchema = z.object({
  confidence: listingBrandModelResearchConfidenceSchema,
  is_real_shaper: z.boolean(),
  is_category_match: z.boolean(),
  official_website_url: z.string().trim().url().nullable(),
  brand_name: z.string().trim().min(2).max(120).nullable(),
  model_name: z.string().trim().min(2).max(120).nullable(),
  location_label: z.string().trim().max(160).nullable(),
  founder_name: z.string().trim().max(120).nullable(),
  short_description: z.string().trim().max(400).nullable(),
  skip_reason: listingBrandModelResearchSkipReasonSchema.nullable(),
  notes: z.string().trim().max(400).nullable(),
})

export type ListingBrandModelResearchResult = z.infer<
  typeof listingBrandModelResearchResultSchema
>

export const listingBrandModelResearchReviewStatusSchema = z.enum([
  "unmatched",
  "needs_review",
])

export type ListingBrandModelResearchReviewStatus = z.infer<
  typeof listingBrandModelResearchReviewStatusSchema
>

export const listingBrandModelAutofillSourceSchema = z.enum([
  "title_backfill",
  "label_backfill",
  "research_create",
])

export type ListingBrandModelAutofillSource = z.infer<
  typeof listingBrandModelAutofillSourceSchema
>
