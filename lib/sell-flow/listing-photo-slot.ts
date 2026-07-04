import { assertListingOriginalSize } from "@/lib/listing-image-pipeline"
import type { PreparedListingImagePair } from "@/lib/listing-image-pipeline"

export type ListingPhotoSlot = {
  clientId: string
  /** Local preview (blob URL) until we can show uploaded thumb */
  previewUrl: string
  id?: string
  url?: string
  thumbnailUrl?: string
  optimizePhase: "idle" | "running" | "done" | "error"
  uploadPhase: "idle" | "uploading" | "done" | "error"
  progressFull: number
  progressThumb: number
  errorMessage?: string
  sourceFile?: File
  prepared?: PreparedListingImagePair
  /** True = apply 180° after automatic landscape→portrait step (toggle). */
  userRotate180?: boolean
  /**
   * After upload, drop `sourceFile` so the next rotation re-downloads from `url`.
   * Server-hydrated rows and temporary fetches for editing use this; user-picked files do not.
   */
  dropSourceFileAfterUpload?: boolean
  /** Bumps when re-processing the same slot so stale async work does not apply. */
  prepareSeq?: number
}

export const LISTING_PHOTO_MAX_DEFAULT = 12

const LISTING_PHOTO_FILE_EXT_RE = /\.(heic|heif|jpe?g|png|webp|gif|avif|tif?f)$/i

export function isListingPhotoFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (mime.startsWith("image/")) return true
  return LISTING_PHOTO_FILE_EXT_RE.test(file.name)
}

export function filesFromDataTransfer(dt: DataTransfer): File[] {
  const fromList = Array.from(dt.files ?? []).filter(isListingPhotoFile)
  if (fromList.length) return fromList
  const out: File[] = []
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue
    const file = item.getAsFile()
    if (file && isListingPhotoFile(file)) out.push(file)
  }
  return out
}

export function isOsFileDragEvent(e: React.DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types ?? [])
  return (
    types.includes("Files") ||
    types.includes("public.file-url") ||
    types.includes("application/x-moz-file")
  )
}

export function listingPhotoSlotsFromDraftBlobs(
  blobs: { name: string; type: string; buffer: ArrayBuffer }[],
): ListingPhotoSlot[] {
  const slots: ListingPhotoSlot[] = []
  for (const b of blobs) {
    try {
      const file = new File([b.buffer], b.name || "photo.jpg", {
        type: b.type || "image/jpeg",
      })
      assertListingOriginalSize(file)
      const clientId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      slots.push({
        clientId,
        previewUrl,
        optimizePhase: "running",
        uploadPhase: "idle",
        progressFull: 0,
        progressThumb: 0,
        sourceFile: file,
      })
    } catch {
      /* skip oversized / invalid blob */
    }
  }
  return slots
}

/** Photos can be written to `listing_images` for a server draft row. */
export function listingPhotosReadyForDraftSync(slots: ListingPhotoSlot[]): boolean {
  return (
    slots.length > 0 && slots.every((im) => im.uploadPhase === "done" && Boolean(im.url?.trim()))
  )
}

export function listingPhotosUploadReady(slots: ListingPhotoSlot[]): boolean {
  return !slots.some(
    (im) =>
      im.uploadPhase !== "done" || !im.url?.trim() || !im.thumbnailUrl?.trim(),
  )
}

export function listingPhotosUploadingCount(slots: ListingPhotoSlot[]): number {
  return slots.filter(
    (p) =>
      p.optimizePhase === "running" ||
      p.uploadPhase === "uploading" ||
      (p.optimizePhase === "done" &&
        p.uploadPhase !== "done" &&
        p.uploadPhase !== "error"),
  ).length
}

export function readyListingPhotoUrls(slots: ListingPhotoSlot[]): ListingPhotoSlot[] {
  return slots.filter((p) => p.uploadPhase === "done" && Boolean(p.url?.trim()))
}
