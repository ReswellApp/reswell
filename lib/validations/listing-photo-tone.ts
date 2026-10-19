import { z } from "zod"
import {
  LISTING_PHOTO_TONE_MAX,
  LISTING_PHOTO_TONE_MIN,
} from "@/lib/utils/listing-photo-tone"

const stopSchema = z.number().int().min(LISTING_PHOTO_TONE_MIN).max(LISTING_PHOTO_TONE_MAX)

export const listingPhotoToneFieldsSchema = z.object({
  brightness: stopSchema,
  highlights: stopSchema,
  shadows: stopSchema,
  contrast: stopSchema,
})

export const listingPhotoToneSaveSchema = z.object({
  images: z
    .array(
      listingPhotoToneFieldsSchema.extend({
        id: z.string().uuid(),
      }),
    )
    .min(1)
    .max(24),
})

export type ListingPhotoToneSaveInput = z.infer<typeof listingPhotoToneSaveSchema>
