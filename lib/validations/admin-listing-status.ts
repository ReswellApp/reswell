import { z } from "zod"

export const ADMIN_LISTING_STATUS_VALUES = [
  "active",
  "removed",
  "sold",
  "pending",
  "pending_sale",
  "draft",
] as const

export type AdminListingStatus = (typeof ADMIN_LISTING_STATUS_VALUES)[number]

export const adminListingStatusBodySchema = z.object({
  status: z.enum(ADMIN_LISTING_STATUS_VALUES),
})

export const adminListingStatusBulkBodySchema = z.object({
  listing_ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(ADMIN_LISTING_STATUS_VALUES),
})
