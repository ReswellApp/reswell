import { z } from "zod"
import { LISTING_VIDEO_MAX_COUNT } from "@/lib/listing-video-constants"

export const listingVideoSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  contentType: z.string().trim().max(100).nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
})

export const listingVideosFieldSchema = z
  .array(listingVideoSchema)
  .max(LISTING_VIDEO_MAX_COUNT, "You can add up to 1 video")
  .optional()
  .default([])

export const listingRemovedVideoIdsSchema = z
  .array(z.string().uuid())
  .optional()
  .default([])

export type ListingVideoInput = z.infer<typeof listingVideoSchema>
