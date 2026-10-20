export type ListingMediaSignatureImage = {
  id?: string
  url?: string
  thumbnailUrl?: string | null
}

export type ListingMediaSignatureVideo = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  contentType?: string | null
  durationSeconds?: number | null
  byteSize?: number | null
}

export type ListingMediaSignatureInput = {
  images: ListingMediaSignatureImage[]
  removedImageIds: string[]
  video: ListingMediaSignatureVideo | null
  removedVideoIds: string[]
}

function part(value: string | number | null | undefined): string {
  if (value == null) return ""
  return String(value)
}

/** Stable fingerprint of the photos and video a listing save would write. */
export function listingMediaSignature(input: ListingMediaSignatureInput): string {
  const images = input.images
    .map((img, index) =>
      [index, part(img.id), part(img.url).trim(), part(img.thumbnailUrl).trim()].join("\u001f"),
    )
    .join("\u001e")
  const video = input.video
    ? [
        part(input.video.id),
        input.video.url.trim(),
        part(input.video.thumbnailUrl).trim(),
        part(input.video.contentType).trim(),
        part(input.video.durationSeconds),
        part(input.video.byteSize),
      ].join("\u001f")
    : ""
  return [
    images,
    input.removedImageIds.join(","),
    video,
    input.removedVideoIds.join(","),
  ].join("\u001d")
}

export function listingMediaUnchanged(
  loadedSignature: string | null,
  current: ListingMediaSignatureInput,
): boolean {
  if (!loadedSignature) return false
  return loadedSignature === listingMediaSignature(current)
}
