import { isListingVideoUploadCanceled } from "./friendly-listing-video-error.ts"
import { UploadStallError } from "./upload-stall-watch.ts"

export function isRetryableListingVideoUploadError(err: unknown): boolean {
  if (isListingVideoUploadCanceled(err)) return false
  if (err instanceof UploadStallError) return false
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  if (lower.includes("timed out")) return false
  if (lower.includes("network error")) return true
  if (/upload failed \(5\d\d\)/i.test(message)) return true
  if (/upload failed \(408\)/i.test(message)) return true
  if (/upload failed \(429\)/i.test(message)) return true
  return false
}
