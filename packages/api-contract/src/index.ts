import { z } from "zod"

/** Stable `/api/mobile/v1` shapes. Add fields freely. Renames and removals wait for v2. */

export const mobileMeSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  display_name: z.string(),
  seller_slug: z.string().nullable(),
  avatar_url: z.string().nullable(),
})

export const mobileListingCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable(),
  title: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  condition: z.string().nullable(),
  condition_label: z.string().nullable(),
  section: z.string(),
  board_type: z.string().nullable(),
  dimensions: z.string().nullable(),
  price_usd: z.number(),
  price_cents: z.number().int(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  shipping_available: z.boolean(),
  local_pickup: z.boolean(),
  image_url: z.string().nullable(),
  price_label: z.string(),
  condition_line: z.string().nullable(),
  shipping_label: z.string().nullable(),
  pickup_label: z.string().nullable(),
})

export const mobileListingDetailSchema = mobileListingCardSchema.extend({
  status: z.string(),
  description: z.string().nullable(),
  image_urls: z.array(z.string()),
  seller: z.object({
    name: z.string(),
    seller_slug: z.string().nullable(),
  }),
})

export const mobileListingsPageSchema = z.object({
  listings: z.array(mobileListingCardSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
})

export const mobileListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
})

export const mobileListingParamSchema = z.object({
  id: z.string().trim().min(1).max(200),
})

export const mobileApiErrorSchema = z.object({
  error: z.string(),
})

export type MobileMe = z.infer<typeof mobileMeSchema>
export type MobileListingCard = z.infer<typeof mobileListingCardSchema>
export type MobileListingDetail = z.infer<typeof mobileListingDetailSchema>
export type MobileListingsPage = z.infer<typeof mobileListingsPageSchema>
export type MobileListingsQuery = z.infer<typeof mobileListingsQuerySchema>
