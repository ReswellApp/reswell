export type ListingVideoSlotStatus =
  | "pending_auth"
  | "uploading"
  | "ready"
  | "error"

export type ListingVideoSlot = {
  clientId: string
  /** Existing DB row id when editing. */
  id?: string
  status: ListingVideoSlotStatus
  /** Local object URL or public storage URL for preview. */
  previewUrl: string | null
  url: string | null
  thumbnailUrl: string | null
  contentType: string | null
  durationSeconds: number | null
  byteSize: number | null
  file?: File | null
  errorMessage?: string | null
  uploadProgress?: number | null
}

export function createEmptyListingVideoSlot(partial?: Partial<ListingVideoSlot>): ListingVideoSlot {
  return {
    clientId: partial?.clientId ?? crypto.randomUUID(),
    id: partial?.id,
    status: partial?.status ?? "ready",
    previewUrl: partial?.previewUrl ?? null,
    url: partial?.url ?? null,
    thumbnailUrl: partial?.thumbnailUrl ?? null,
    contentType: partial?.contentType ?? null,
    durationSeconds: partial?.durationSeconds ?? null,
    byteSize: partial?.byteSize ?? null,
    file: partial?.file ?? null,
    errorMessage: partial?.errorMessage ?? null,
    uploadProgress: partial?.uploadProgress ?? null,
  }
}

export function listingVideoUploadReady(slot: ListingVideoSlot | null): boolean {
  if (!slot) return true
  return slot.status === "ready" && Boolean(slot.url?.trim())
}

export function listingVideoIsUploading(slot: ListingVideoSlot | null): boolean {
  return slot?.status === "uploading"
}

/** Poster / storage image URLs vs local video blobs and `.mp4` / `.mov` / `.webm` objects. */
export function isListingVideoImagePreviewUrl(url: string): boolean {
  if (!url || url.startsWith("blob:")) return false
  const path = url.split("?")[0]?.toLowerCase() ?? ""
  return !path.endsWith(".mp4") && !path.endsWith(".mov") && !path.endsWith(".webm")
}

export function listingVideoUploadStatusLabel(slot: ListingVideoSlot): string {
  if (slot.status !== "uploading") return "Uploading…"
  const progress = slot.uploadProgress
  if (progress == null || progress < 0.12) return "Preparing…"
  const pct = Math.max(1, Math.min(99, Math.round(progress * 100)))
  return `Uploading ${pct}%`
}

export function readyListingVideoPayload(slot: ListingVideoSlot | null): {
  id?: string
  url: string
  thumbnailUrl: string | null
  contentType: string | null
  durationSeconds: number | null
  byteSize: number | null
  sortOrder: number
} | null {
  if (!slot || slot.status !== "ready" || !slot.url?.trim()) return null
  return {
    id: slot.id,
    url: slot.url.trim(),
    thumbnailUrl: slot.thumbnailUrl,
    contentType: slot.contentType,
    durationSeconds: slot.durationSeconds,
    byteSize: slot.byteSize,
    sortOrder: 0,
  }
}
