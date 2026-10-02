/**
 * Supabase auth serializes session work with `navigator.locks`. In Chrome that
 * request can stay pending forever (a discarded tab still owns the lock), so
 * `getSession()` never resolves and the sign-in form stays on its spinner.
 * Safari has no Web Locks implementation, which is why the same page loads there.
 *
 * Wait briefly for the cross-tab lock, then run the operation on an in-tab queue.
 */

const tails = new Map<string, Promise<void>>()

async function runInTab<R>(name: string, fn: () => Promise<R>): Promise<R> {
  const previous = tails.get(name) ?? Promise.resolve()
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  tails.set(
    name,
    previous.then(
      () => gate,
      () => gate,
    ),
  )
  await previous.catch(() => undefined)
  try {
    return await fn()
  } finally {
    release()
  }
}

type WebLockRequest = (
  name: string,
  options: { mode: "exclusive" },
  callback: () => Promise<unknown>,
) => Promise<unknown>

export async function browserAuthLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const request = globalThis.navigator?.locks?.request as WebLockRequest | undefined
  if (typeof request !== "function" || acquireTimeout <= 0) {
    return runInTab(name, fn)
  }

  const timeoutMs = Math.min(acquireTimeout, 1500)
  let claimed = false
  const claim = () => {
    if (claimed) return false
    claimed = true
    return true
  }

  const locked = request
    .call(globalThis.navigator.locks, name, { mode: "exclusive" }, async () => {
      if (!claim()) return undefined
      return await fn()
    })
    .then(
      (value) => ({ status: "acquired" as const, value }),
      () => ({ status: "failed" as const, value: undefined }),
    )

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => resolve("timeout"), timeoutMs)
  })

  const winner = await Promise.race([locked, timedOut])
  if (timeoutId) clearTimeout(timeoutId)

  if (winner !== "timeout") {
    if (winner.status === "acquired" && claimed) return winner.value as R
    if (!claim()) {
      const settled = await locked
      if (settled.status === "acquired") return settled.value as R
    }
  } else if (!claim()) {
    const settled = await locked
    if (settled.status === "acquired") return settled.value as R
  }

  return runInTab(name, fn)
}
