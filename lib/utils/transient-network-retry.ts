/**
 * Network-level failures (undici "fetch failed", resets, timeouts) — transient,
 * worth retrying. These are connection-level problems reaching Supabase from a
 * serverless function, not application/logic errors.
 */
export function isTransientNetworkError(message: string | null | undefined): boolean {
  if (!message) return false
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network|service unavailable|\b503\b|\b502\b|\b504\b/i.test(
    message,
  )
}

const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 200

type SupabaseLikeResult<T> = { data: T; error: { message: string } | null }

interface RetryOptions {
  attempts?: number
  baseDelayMs?: number
}

/**
 * Runs a Supabase query/RPC and retries only when the failure is a transient
 * network error. Non-transient errors (and successes) return immediately.
 * Uses linear backoff (baseDelay * attempt).
 */
export async function retryOnTransientNetworkError<T>(
  run: () => PromiseLike<SupabaseLikeResult<T>>,
  options: RetryOptions = {},
): Promise<SupabaseLikeResult<T>> {
  const attempts = options.attempts ?? DEFAULT_RETRY_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS

  let lastResult: SupabaseLikeResult<T> = {
    data: null as T,
    error: { message: "retryOnTransientNetworkError: no attempts run" },
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    lastResult = await run()

    if (!lastResult.error || !isTransientNetworkError(lastResult.error.message)) {
      return lastResult
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt))
    }
  }

  return lastResult
}
