/**
 * In-browser HD listing video capture (getUserMedia + MediaRecorder).
 * Prefer this over OS “Take Video” from `<input type="file">`, which is often soft.
 */

import {
  LISTING_VIDEO_MAX_DURATION_SECONDS,
  LISTING_VIDEO_MIN_DURATION_SECONDS,
} from "@/lib/listing-video-constants"

export const LISTING_VIDEO_RECORDER_VIDEO_BITS_PER_SECOND = 8_000_000
export const LISTING_VIDEO_RECORDER_AUDIO_BITS_PER_SECOND = 128_000

export type ListingVideoRecorderMime = {
  mimeType: string
  extension: "webm" | "mp4"
}

/** Best supported container/codec for this browser. */
export function pickListingVideoRecorderMime(): ListingVideoRecorderMime | null {
  if (typeof MediaRecorder === "undefined") return null

  const candidates: ListingVideoRecorderMime[] = [
    { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ]

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate
  }
  return null
}

export function listingVideoRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined" &&
    pickListingVideoRecorderMime() != null
  )
}

/** Ideal rear-camera 1080p@30 — browser may downstep if unsupported. */
export function listingVideoRecorderMediaConstraints(): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
  }
}

/** Looser fallback when the HD constraint set fails (older phones / desktop cams). */
export function listingVideoRecorderFallbackConstraints(): MediaStreamConstraints {
  return {
    audio: true,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  }
}

export async function openListingVideoRecorderStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera recording isn’t supported in this browser.")
  }
  try {
    return await navigator.mediaDevices.getUserMedia(listingVideoRecorderMediaConstraints())
  } catch {
    return navigator.mediaDevices.getUserMedia(listingVideoRecorderFallbackConstraints())
  }
}

export function stopListingVideoRecorderStream(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      /* already stopped */
    }
  }
}

export function listingVideoRecorderMinSeconds(): number {
  return LISTING_VIDEO_MIN_DURATION_SECONDS
}

export function listingVideoRecorderMaxSeconds(): number {
  return LISTING_VIDEO_MAX_DURATION_SECONDS
}

export function formatListingVideoRecorderClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, "0")}`
}

/** Assign a File to a hidden `<input type="file">` and fire change for existing handlers. */
export function dispatchFileToInput(input: HTMLInputElement, file: File): void {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
  input.dispatchEvent(new Event("change", { bubbles: true }))
}
