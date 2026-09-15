import { isAbortError } from "./is-abort-error.ts"

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
    /^upload failed \(\d+\)$/i.test(message)
  )
}

/** User-facing copy for Blog CMS cover / inline image upload failures. */
export function friendlyBlogImageErrorMessage(err: unknown): string {
  const raw = errorMessage(err)

  if (isAbortError(err) || isAbortError({ message: raw })) {
    return "Upload was interrupted. Try again."
  }

  if (!raw) {
    return "This image didn't upload. Try again."
  }

  const lower = raw.toLowerCase()
  if (
    lower.includes("sign in") ||
    lower.includes("jwt") ||
    lower.includes("unauthorized") ||
    lower.includes("not authorized") ||
    lower.includes("row-level security")
  ) {
    return "Sign in again to upload this image."
  }

  if (/bucket not found/i.test(raw)) {
    return "Blog image storage is not set up yet. Refresh the CMS, or run Supabase migrations."
  }

  if (/over 8\s*mb|must be under 8|too large/i.test(raw)) {
    return raw
  }

  if (/choose an image|isn't supported|mime type|invalid file type/i.test(raw)) {
    return raw
  }

  if (looksTechnical(raw)) {
    return "This image didn't upload. Try again."
  }

  return raw
}
