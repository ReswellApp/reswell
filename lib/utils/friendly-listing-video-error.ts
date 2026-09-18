import { isAbortError } from "./is-abort-error.ts"
import { UploadStallError } from "./upload-stall-watch.ts"

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === "string" && err.trim()) return err.trim()
  return ""
}

/** True only for an intentional AbortController / XHR abort — not generic fetch failures. */
export function isListingVideoUploadCanceled(err: unknown): boolean {
  if (err == null) return false
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return err.name === "AbortError"
  }
  return err instanceof Error && err.name === "AbortError"
}

/** User-facing copy for listing video pick / prepare / upload failures. */
export function friendlyListingVideoError(err: unknown): string {
  if (err instanceof UploadStallError) {
    return err.message
  }

  const raw = errorMessage(err)
  const lower = raw.toLowerCase()

  if (!raw) {
    return "Couldn't upload that video. Try again with an MP4 or MOV under 200MB."
  }

  if (
    lower.includes("sign in again") ||
    lower.includes("jwt") ||
    lower.includes("not authorized") ||
    lower.includes("unauthorized")
  ) {
    return "Sign in again to upload this video."
  }

  if (lower.includes("stalled") || lower.includes("timed out") || lower.includes("timeout")) {
    return "Upload stalled. Check your connection and try again."
  }

  if (lower.includes("network error") || isAbortError({ message: raw })) {
    return "Upload failed. Check your connection and try again."
  }

  if (lower.includes("over 200") || /too large|must be under/i.test(raw)) {
    return raw
  }

  return raw
}
