import { PromiseDeadlineError } from "@/lib/utils/race-with-deadline"
import { isAbortError } from "@/lib/utils/is-abort-error"

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === "string" && err.trim()) return err.trim()
  return ""
}

function looksTechnical(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("aborterror") ||
    lower.includes("domexception") ||
    lower.includes("operation was aborted") ||
    lower.includes("signal is aborted") ||
    lower.includes("err_") ||
    lower.includes("http ") ||
    lower.includes("could not decode") ||
    lower.includes("could not encode") ||
    lower.includes("canvas not available") ||
    lower.includes("conversion failed") ||
    lower.includes("jwt") ||
    lower.includes("row-level security") ||
    /^upload failed \(\d+\)$/i.test(message)
  )
}

/** User-facing copy for message photo/video prepare / upload / send failures. */
export function friendlyMessageMediaErrorMessage(err: unknown): string {
  if (err instanceof PromiseDeadlineError || errorMessage(err) === "timed_out") {
    return "That took too long. Check your connection — if the photo isn't in the chat, try again."
  }

  if (isAbortError(err)) {
    return ""
  }

  const raw = errorMessage(err)
  if (!raw) {
    return "Couldn't send this. Try again."
  }

  const lower = raw.toLowerCase()

  if (
    lower.includes("sign in again") ||
    lower.includes("unauthorized") ||
    lower.includes("not authorized") ||
    lower.includes("jwt")
  ) {
    return "Sign in again to send photos and videos."
  }

  if (/over 20\s*mb|too large|must be under/i.test(raw)) {
    return raw.includes("video") || lower.includes("500")
      ? raw
      : "That photo is too large. Choose one under 20MB."
  }

  if (/over 500\s*mb|2 minutes|trim it/i.test(raw)) {
    return raw
  }

  if (/heic|heif/i.test(raw)) {
    return "We couldn't read this iPhone photo. Tap Retry — or export it as JPEG from Photos."
  }

  if (/isn't supported|not supported|invalid file type|mime type/i.test(raw)) {
    return "That file type isn't supported. Try a JPEG, PNG, or MP4."
  }

  if (lower.includes("network error") || lower.includes("failed to fetch")) {
    return "Network hiccup while uploading. Tap Retry."
  }

  if (lower.includes("attachment not found")) {
    return "Upload didn't finish. Tap Retry."
  }

  if (looksTechnical(raw)) {
    return "Couldn't send this. Tap Retry."
  }

  return raw
}
