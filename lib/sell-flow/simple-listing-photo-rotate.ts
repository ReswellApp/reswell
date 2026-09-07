import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

export type SimpleSellPhotoSlot = {
  clientId: string
  previewUrl: string
  file?: File
  imageId?: string
  url?: string
  thumbnailUrl?: string
  phase: "optimizing" | "uploading" | "done" | "error"
  progress: number
  /** True = apply 180° after automatic landscape→portrait (toggle). */
  userRotate180?: boolean
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

export async function simpleSellPhotoSlotForRotate180<T extends SimpleSellPhotoSlot>(
  slot: T,
): Promise<T> {
  let file = slot.file
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
  }

  return {
    ...slot,
    file,
    userRotate180: !slot.userRotate180,
    phase: "optimizing",
    progress: 0,
    url: undefined,
    thumbnailUrl: undefined,
  }
}
