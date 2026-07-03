import { z } from "zod"

export const partnerEmbedSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only")

export const adminCreatePartnerEmbedBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: partnerEmbedSlugSchema.optional(),
  partner_label: z.string().trim().max(120).optional().nullable(),
  headline: z.string().trim().min(2).max(200).optional(),
  subheadline: z.string().trim().min(2).max(300).optional(),
  cta_primary: z.string().trim().min(2).max(80).optional(),
  cta_secondary: z.string().trim().min(2).max(80).optional(),
})

export const adminUpdatePartnerEmbedBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  partner_label: z.string().trim().max(120).optional().nullable(),
  headline: z.string().trim().min(2).max(200).optional(),
  subheadline: z.string().trim().min(2).max(300).optional(),
  cta_primary: z.string().trim().min(2).max(80).optional(),
  cta_secondary: z.string().trim().min(2).max(80).optional(),
  is_active: z.boolean().optional(),
})

export const adminPartnerEmbedListingBodySchema = z.object({
  listing_id: z.string().uuid(),
})

export const adminPartnerEmbedReorderBodySchema = z.object({
  ordered_row_ids: z.array(z.string().uuid()).min(1),
})
