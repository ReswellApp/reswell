import { isAbortError } from "@/lib/utils/is-abort-error"
import { isStaleFileNotFoundError } from "@/lib/utils/is-stale-file-not-found-error"

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === "string" && err.trim()) return err.trim()
  return ""
}

function isMemoryPressureMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    isAbortError({ message }) ||
    lower.includes("out of memory") ||
    lower.includes("ran low on memory") ||
    lower.includes("insufficient resources") ||
    lower.includes("allocation failed") ||
    (lower.includes("memory") && lower.includes("process"))
  )
}

function isFileTooLargeMessage(message: string): boolean {
  return /over 20\s*mb|too large|must be under/i.test(message)
}

function isHeicConversionMessage(message: string): boolean {
  return /heic|heif/i.test(message)
}

function isUnsupportedFormatMessage(message: string): boolean {
  return /isn't supported|not supported in your browser|choose an image file/i.test(
    message,
  )
}

function looksTechnical(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("aborterror") ||
    lower.includes("domexception") ||
    lower.includes("notfounderror") ||
    lower.includes("operation was aborted") ||
    lower.includes("signal is aborted") ||
    lower.includes("err_") ||
    lower.includes("http ") ||
    lower.includes("image worker") ||
    lower.includes("could not decode") ||
    lower.includes("could not encode") ||
    lower.includes("canvas not available") ||
    lower.includes("conversion failed") ||
    lower.includes("photo processing failed")
  )
}

/** User-facing copy for listing photo pick / optimize / upload failures. */
export function friendlyListingPhotoErrorMessage(
  err: unknown,
  context: "add" | "upload" | "rotate" = "add",
): string {
  const raw = errorMessage(err)

  if (isStaleFileNotFoundError(err) || isStaleFileNotFoundError(raw)) {
    if (context === "rotate") return "We couldn't rotate this photo. Try again."
    if (context === "upload") return "This photo is no longer available. Choose it again."
    return "This photo is no longer available. Choose it again."
  }

  if (context === "rotate") {
    if (!raw || looksTechnical(raw)) {
      return "We couldn't rotate this photo. Try again."
    }
    return raw
  }

  if (context === "upload") {
    if (!raw) {
      return "This photo didn't upload. Try again."
    }
    const lower = raw.toLowerCase()
    if (
      lower.includes("sign in again") ||
      lower.includes("jwt") ||
      lower.includes("not authorized") ||
      lower.includes("unauthorized") ||
      lower.includes("row-level security")
    ) {
      return "Sign in again to upload this photo."
    }
    if (isFileTooLargeMessage(raw)) {
      return "That photo is too large after processing. Try a smaller original."
    }
    if (/mime type|not supported|invalid file type/i.test(raw)) {
      return "That photo format isn't supported. Try JPEG or PNG."
    }
    if (looksTechnical(raw) && !/^upload failed \(\d+\)/i.test(raw)) {
      return "This photo didn't upload. Try again."
    }
    return raw
  }

  if (isFileTooLargeMessage(raw)) {
    return "That photo is too large. Choose one under 20MB."
  }

  if (isHeicConversionMessage(raw)) {
    return "We couldn't read this iPhone photo. Tap Retry — if it keeps failing, try one photo at a time."
  }

  if (isUnsupportedFormatMessage(raw)) {
    return "That file type isn't supported. Try JPEG or PNG."
  }

  if (isMemoryPressureMessage(raw)) {
    return "We couldn't add this photo. Tap Retry, or try a smaller image."
  }

  if (!raw || looksTechnical(raw)) {
    return "We couldn't add this photo. Try again."
  }

  return raw
}
