import { z } from "zod"

const listingImageSyncItemSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().trim().min(1).max(2000),
  thumbnailUrl: z.string().trim().max(2000).nullable().optional(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0).max(24),
})

/** Desired gallery for one listing. The server reconciles rows to this set. */
export const listingImageSyncSchema = z.object({
  listingId: z.string().uuid(),
  removedImageIds: z.array(z.string().uuid()).max(24).default([]),
  images: z.array(listingImageSyncItemSchema).max(12),
})

export type ListingImageSyncInput = z.infer<typeof listingImageSyncSchema>
