import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  listingPhotoQuarterTurnsAfterAdjust,
  type ListingPhotoQuarterTurns,
} from "@/lib/sell-flow/listing-photo-orientation"

export type SimpleSellPhotoSlot = {
  clientId: string
  previewUrl: string
  file?: File
  imageId?: string
  url?: string
  thumbnailUrl?: string
  phase: "optimizing" | "uploading" | "done" | "error"
  progress: number
  errorMessage?: string
  /** @deprecated Session leftover. Quarter turns replace this. */
  userRotate180?: boolean
  /** Extra clockwise 90° turns on top of automatic camera orientation. */
  userQuarterTurns?: ListingPhotoQuarterTurns
  /** Downloaded listing file. Skip the landscape→portrait pass. */
  sourceIsDerivative?: boolean
  /** True once `previewUrl` is a small derivative safe to show during upload. */
  localPreviewReady?: boolean
}

export function canRotateSimpleSellPhoto(slot: SimpleSellPhotoSlot): boolean {
  if (slot.phase !== "done") return false
  return Boolean(slot.file) || Boolean((slot.url ?? "").trim())
}

export function listingPhotoPreviewFromPrepared(
  currentPreviewUrl: string,
  preparedThumb: Blob,
): string {
  if (currentPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(currentPreviewUrl)
  return URL.createObjectURL(preparedThumb)
}

export async function simpleSellPhotoSlotForQuarterTurn<T extends SimpleSellPhotoSlot>(
  slot: T,
  delta: number,
): Promise<T> {
  let file = slot.file
  let base: T = slot
  if (!file) {
    const fullUrl = (slot.url ?? "").trim()
    if (!fullUrl) {
      throw new Error("Could not load this photo to rotate it.")
    }
    const src = proxiedListingImageSrc(fullUrl) ?? fullUrl
    const res = await fetch(src)
    if (!res.ok) {
      throw new Error("Could not load this photo to rotate it.")
    }
    const blob = await res.blob()
    file = new File([blob], "listing-photo.jpg", {
      type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg",
    })
    base = { ...slot, sourceIsDerivative: true }
  }

  const orientation = listingPhotoQuarterTurnsAfterAdjust(
    { ...base, sourceFile: file },
    delta,
  )

  return {
    ...base,
    file,
    userQuarterTurns: orientation.userQuarterTurns,
    sourceIsDerivative: orientation.sourceIsDerivative,
    userRotate180: undefined,
    phase: "optimizing",
    progress: 0,
    url: undefined,
    thumbnailUrl: undefined,
  }
}
