/**
 * In-tab auth lock. The browser Supabase client must not pass this as `auth.lock`.
 *
 * auth-js 2.118 coordinates refreshes without a lock and does not use
 * `navigator.locks`. Supplying a custom lock opts into the legacy path, where a
 * 5s acquire timeout during a sell photo batch deletes the session.
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

export async function browserAuthLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const previous = pendingByName.get(name) ?? Promise.resolve()

  const current = Promise.race(
    [
      previous.catch(() => null),
      acquireTimeout >= 0
        ? new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new BrowserAuthLockTimeoutError(name))
            }, acquireTimeout)
          })
        : null,
    ].filter((entry): entry is Promise<unknown> => entry !== null),
  )
    .catch((error: unknown) => {
      if (isLockTimeout(error)) throw error
      return null
    })
    .then(async () => fn())

  // Keep the tail after a timeout so a later caller still waits out the holder.
  // Dropping this entry let a new sign-in run beside the in-flight auth call.
  pendingByName.set(
    name,
    current.catch(async (error: unknown) => {
      if (isLockTimeout(error)) {
        await previous.catch(() => null)
        return null
      }
      throw error
    }),
  )

  return await current
}
