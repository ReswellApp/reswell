import { isAbortError } from "@/lib/utils/is-abort-error"

/**
 * One retry after a cancelled fetch (Next.js route change, tab hide, flaky radio).
 * The second call should reuse the same idempotency key when the first request
 * may already have landed on the server.
 */
export async function retryOnceOnAbort<T>(
  fn: () => Promise<T>,
  delayMs = 280,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isAbortError(error)) throw error
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    return await fn()
  }
}
