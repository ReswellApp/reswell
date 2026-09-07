/**
 * Chromium / WebKit throw this when a picker `File` (or Cache / OPFS handle) is
 * still referenced in JS but the OS backing path was already evicted — common
 * after camera-roll picks, Android content URIs, and tab suspension.
 *
 *   NotFoundError: A requested file or directory could not be found at the time
 *   an operation was processed.
 */

const STALE_FILE_NOT_FOUND =
  /requested file or directory could not be found at the time an operation was processed/i
const STALE_FILE_UNREADABLE =
  /requested file could not be read|permission problems that have occurred after a reference to a file/i

function messageLooksLikeStaleFile(value: string): boolean {
  return STALE_FILE_NOT_FOUND.test(value) || STALE_FILE_UNREADABLE.test(value)
}

/** True when `error` is a stale picker / blob-backing-store read. */
export function isStaleFileNotFoundError(error: unknown, depth = 0): boolean {
  if (error == null || depth > 4) return false

  if (error instanceof Error) {
    if (messageLooksLikeStaleFile(`${error.name} ${error.message} ${error.stack ?? ""}`)) {
      return true
    }
    if ("cause" in error && isStaleFileNotFoundError(error.cause, depth + 1)) return true
    return false
  }

  if (typeof error === "string") return messageLooksLikeStaleFile(error)

  if (typeof error === "object") {
    const rec = error as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown }
    const combined = [rec.name, rec.message, rec.stack]
      .filter((part): part is string => typeof part === "string")
      .join(" ")
    if (combined && messageLooksLikeStaleFile(combined)) return true
    if ("cause" in error && isStaleFileNotFoundError(rec.cause, depth + 1)) return true
  }

  return false
}

type PostHogEventLike = {
  event?: string
  properties?: Record<string, unknown> | null
} | null | undefined

function collectExceptionText(properties: Record<string, unknown> | null | undefined): string {
  if (!properties) return ""
  const parts: string[] = []

  const topMessage = properties.$exception_message
  if (typeof topMessage === "string") parts.push(topMessage)

  const list = properties.$exception_list
  if (!Array.isArray(list)) return parts.join("\n")

  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    for (const key of ["type", "value", "$exception_type", "$exception_message"] as const) {
      const value = rec[key]
      if (typeof value === "string") parts.push(value)
    }
  }

  return parts.join("\n")
}

/** Drop `$exception` events that are stale picker-file reads, not application bugs. */
export function isPostHogStaleFileNotFoundError(event: PostHogEventLike): boolean {
  if (!event || event.event !== "$exception") return false
  return isStaleFileNotFoundError(collectExceptionText(event.properties))
}
