import { Image, type ImageContentFit, type ImageProps } from "expo-image"
import { LISTING_IMAGE_CACHE_POLICY, listingImageRecyclingKey } from "@/lib/listing-image"

type ListingImagePriority = NonNullable<ImageProps["priority"]>

/** Warm the disk cache for the next gallery photo without mounting it. */
export function prefetchListingImage(uri: string): void {
  if (!uri) return
  Image.prefetch(uri, LISTING_IMAGE_CACHE_POLICY).catch(() => undefined)
}

/** Marketplace photo with a shared memory+disk cache. Call sites keep their own `contentFit`. */
export function ListingImage({
  uri,
  listingId,
  priority = "normal",
  contentFit,
  style,
}: {
  uri: string
  listingId?: string
  priority?: ListingImagePriority
  contentFit: ImageContentFit
  style?: ImageProps["style"]
}) {
  return (
    <Image
      source={{ uri }}
      cachePolicy={LISTING_IMAGE_CACHE_POLICY}
      recyclingKey={listingImageRecyclingKey(uri, listingId)}
      priority={priority}
      contentFit={contentFit}
      style={style}
    />
  )
}
