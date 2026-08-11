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
