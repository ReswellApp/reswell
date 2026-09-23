import { unstable_cache } from "next/cache"
import {
  PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS,
  publicStorageObjectCacheTag,
} from "@/lib/cache/public-storage-object-meta"
import {
  listingDerivativePredatesStoredUploads,
  probeListingStoredDerivative,
  type ListingStoredDerivative,
} from "@/lib/media/listing-stored-derivative"

/**
 * Remember whether a post-cutoff `card2`/`film2` object exists.
 * Pre-cutoff names skip Storage. A later upload of the same key is picked up
 * when `revalidatePublicStorageObjects` drops this tag.
 */
export function getCachedListingStoredDerivative(
  objectPath: string,
  upstreamUrl: string,
): Promise<ListingStoredDerivative> {
  if (listingDerivativePredatesStoredUploads(objectPath)) {
    return Promise.resolve({ state: "missing" })
  }

  const loader = unstable_cache(
    () => probeListingStoredDerivative(upstreamUrl),
    ["listing-stored-derivative-v1", objectPath],
    {
      revalidate: PUBLIC_STORAGE_OBJECT_REVALIDATE_SECONDS,
      tags: [publicStorageObjectCacheTag("listings", objectPath)],
    },
  )
  return loader()
}
