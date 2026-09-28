import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { googleAssetOwnedBy, safeMediaName, type GoogleImageMime } from "@/lib/ads/manager/media"
import { assertGoogleAdsConfigured } from "@/lib/ads/google/config"
import { mutateGoogleAds } from "@/lib/ads/google/http"

const IMAGE_UPLOAD_TIMEOUT_MS = 45_000

export async function uploadGoogleImageAsset(input: {
  filename: string
  bytes: Uint8Array
  mimeType: GoogleImageMime
}): Promise<string> {
  const { customerId } = assertGoogleAdsConfigured()
  const resource = await mutateGoogleAds(
    customerId,
    "assets",
    [
      {
        create: {
          name: safeMediaName(input.filename),
          imageAsset: {
            data: Buffer.from(input.bytes).toString("base64"),
            mimeType: input.mimeType,
          },
        },
      },
    ],
    IMAGE_UPLOAD_TIMEOUT_MS,
  )
  if (!googleAssetOwnedBy(customerId, resource)) {
    throw new AdsPlatformError("Google Ads returned an image outside this account", "google")
  }
  return resource
}
