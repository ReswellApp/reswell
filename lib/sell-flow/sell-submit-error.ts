import { isAbortError, isBenignClientFetchError } from "@/lib/utils/is-abort-error"

/** Seller-facing copy when a save/publish request is cancelled mid-flight. */
export const SELL_SUBMIT_INTERRUPTED_MESSAGE = "Save was interrupted. Please try again."

export function isSellSubmitAbortError(error: unknown): boolean {
  if (isAbortError(error) || isBenignClientFetchError(error)) return true
  if (typeof error === "string") return isAbortError({ message: error })
  return false
}

/**
 * One retry after a cancelled fetch / token-refresh abort.
 * Owner listing saves were toasting "Save was interrupted" on the first abort;
 * admin impersonation already retries this class of error once.
 */
export async function retryOnceOnSellSubmitAbort<T>(
  fn: () => Promise<T>,
  options?: { delayMs?: number; onRetry?: () => Promise<void> },
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isSellSubmitAbortError(error)) throw error
    const delayMs = options?.delayMs ?? 280
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    await options?.onRetry?.()
    return await fn()
  }
}

/** Map thrown / PostgREST errors to a seller-safe string (never raw AbortSignal text). */
export function sellSubmitErrorMessage(error: unknown, fallback: string): string {
  if (isSellSubmitAbortError(error)) return SELL_SUBMIT_INTERRUPTED_MESSAGE
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === "string" && error.trim()) {
    return isAbortError({ message: error }) ? SELL_SUBMIT_INTERRUPTED_MESSAGE : error.trim()
  }
  if (error && typeof error === "object") {
    const o = error as { message?: unknown; details?: unknown; hint?: unknown }
    if (typeof o.message === "string" && o.message.trim()) {
      if (isAbortError({ message: o.message })) return SELL_SUBMIT_INTERRUPTED_MESSAGE
      return o.message
    }
    const parts = [o.details, o.hint].filter(
      (x): x is string => typeof x === "string" && x.trim() !== "",
    )
    if (parts.length) return parts.join(" — ")
  }
  return fallback
}

/** Sanitize server-action / API `error` strings before toasting. */
export function sellActionErrorMessage(
  message: string,
  fallback = "Something went wrong. Please try again.",
): string {
  const trimmed = message.trim()
  if (!trimmed) return fallback
  if (isSellSubmitAbortError(trimmed)) return SELL_SUBMIT_INTERRUPTED_MESSAGE
  return trimmed
}
