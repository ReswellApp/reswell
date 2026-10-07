"use client"

import { runImagePrepareTask } from "@/lib/client-image-cpu-queue"
import {
  createInstantListingPhotoPreview,
  type PrepareListingImagePairOptions,
} from "@/lib/listing-image-pipeline"

/**
 * Small on-device JPEG for the sell photo tile.
 *
 * Uses the same memory queue as the full listing pipeline so a batch of iPhone
 * photos never decodes two frames at once. Callers queue every instant preview
 * before any full prepare: the queue starts the next waiter before the caller's
 * continuation runs, so thumbnails paint before the heavy encode.
 *
 * Returns null when this fast path cannot decode (desktop HEIC, odd formats).
 * Callers then fall back to the prepared thumbnail.
 */
export async function revealListingPhotoPreviewUrl(
  file: Blob,
  options?: PrepareListingImagePairOptions,
): Promise<string | null> {
  try {
    const blob = await runImagePrepareTask(() => createInstantListingPhotoPreview(file, options))
    if (!blob || blob.size === 0) return null
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/**
 * Publish a fast local preview, revoking the previous object URL.
 * Returns whether the tile can paint before the full pipeline finishes.
 */
export async function stageListingPhotoInstantPreview(
  file: Blob,
  currentPreviewUrl: string,
  options: PrepareListingImagePairOptions | undefined,
  publish: (previewUrl: string) => void,
): Promise<boolean> {
  const instantUrl = await revealListingPhotoPreviewUrl(file, options)
  if (!instantUrl) return false
  publish(instantUrl)
  if (currentPreviewUrl.startsWith("blob:") && currentPreviewUrl !== instantUrl) {
    URL.revokeObjectURL(currentPreviewUrl)
  }
  return true
}

/**
 * Keep the on-screen derivative when one is already showing.
 * Otherwise point the tile at the prepared thumb so upload does not cover it.
 * Returns null when the current preview should stay.
 */
export function swapListingPhotoPreviewToPreparedThumb(
  paintedInstant: boolean,
  currentPreviewUrl: string,
  preparedThumb: Blob,
): { previewUrl: string; localPreviewReady: true } | null {
  if (paintedInstant) return null
  if (currentPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(currentPreviewUrl)
  return {
    previewUrl: URL.createObjectURL(preparedThumb),
    localPreviewReady: true,
  }
}
