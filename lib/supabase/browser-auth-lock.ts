/**
 * In-tab auth lock for the browser Supabase client.
 *
 * `@supabase/auth-js` (2.95) uses `navigator.locks` by default and acquires it
 * during init with no timeout (`-1`). Chrome on macOS does not release that lock
 * when a tab is frozen or discarded, so `getSession()` / `signInWithPassword()`
 * never resolve. `/auth/login` then stays on the spinner. This queue serializes
 * auth work in the current tab only. GoTrue resolves cross-tab refresh races.
 *
 * Positive `acquireTimeout` values are for cross-tab Web Locks (another tab can
 * hold the lock while this tab's JS is still running). This lock is in-tab: a
 * wait budget just fails concurrent `getUser()` / `getSession()` while the
 * holder is still working, which PostHog records as BrowserAuthLockTimeoutError.
 * Use {@link toInTabAcquireTimeout} at the client boundary so only auto-refresh
 * (`0` = skip if busy) can time out.
 */

const pendingByName = new Map<string, Promise<unknown>>()

export class BrowserAuthLockTimeoutError extends Error {
  readonly isAcquireTimeout = true

  constructor(lockName: string) {
    super(`Acquiring auth lock with name "${lockName}" timed out`)
    this.name = "BrowserAuthLockTimeoutError"
  }
}

function isLockTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "isAcquireTimeout" in error &&
    (error as { isAcquireTimeout?: unknown }).isAcquireTimeout === true
  )
}

/**
 * Map auth-js lock timeouts onto in-tab queue semantics.
 *
 * - `0` — auto-refresh tick: fail immediately if another auth call is in flight
 * - anything else — wait for the in-tab holder (do not throw)
 */
export function toInTabAcquireTimeout(acquireTimeout: number): number {
  return acquireTimeout === 0 ? 0 : -1
}

export async function browserAuthLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const previous = pendingByName.get(name) ?? Promise.resolve()
  const previousHandled = previous.catch(() => null)

  const current = (async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      if (acquireTimeout >= 0) {
        await Promise.race([
          previousHandled,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new BrowserAuthLockTimeoutError(name))
            }, acquireTimeout)
          }),
        ])
      } else {
        await previousHandled
      }
    } catch (error: unknown) {
      if (isLockTimeout(error)) throw error
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }

    return await fn()
  })()

  // Keep the tail after a timeout so a later caller still waits out the holder.
  // Dropping this entry let a new sign-in run beside the in-flight auth call.
  pendingByName.set(
    name,
    current.catch(async (error: unknown) => {
      if (isLockTimeout(error)) {
        await previousHandled
        return null
      }
      throw error
    }),
  )

  return await current
}
