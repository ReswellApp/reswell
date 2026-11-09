import { z } from "zod"
import { LISTING_PDP_CROP_MAX_ZOOM } from "@/lib/utils/listing-pdp-crop"

export const listingPdpCropFieldsSchema = z.object({
  zoom: z.number().min(0).max(LISTING_PDP_CROP_MAX_ZOOM),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
})

export const listingPdpCropSaveSchema = z.object({
  images: z
    .array(
      listingPdpCropFieldsSchema.extend({
        id: z.string().uuid(),
      }),
    )
    .min(1)
    .max(30),
})

export type ListingPdpCropSaveInput = z.infer<typeof listingPdpCropSaveSchema>
