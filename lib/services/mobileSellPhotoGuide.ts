import { mobileSellPhotoGuideSchema, type MobileSellPhotoGuide } from "@reswell/api-contract"
import { SELL_PHOTO_GUIDE_EXAMPLES } from "@/lib/sell-flow/sell-photo-guide"
import { absoluteUrl } from "@/lib/site-metadata"

/** Same six example shots as website `/sell`. Absolute `/media/listings` URLs for the app. */
export function getMobileSellPhotoGuide(): MobileSellPhotoGuide {
  return mobileSellPhotoGuideSchema.parse({
    examples: SELL_PHOTO_GUIDE_EXAMPLES.map((example) => ({
      id: example.id,
      label: example.label,
      image_url: absoluteUrl(example.path),
    })),
  })
}
