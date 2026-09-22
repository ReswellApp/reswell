/** Fallback so pixels still load if the tab stays idle with no interaction. */
export const DEFER_UNTIL_IDLE_TIMEOUT_MS = 4_000

/** Cheap first-input signals that mean the user is active and LCP has usually passed. */
export const DEFER_UNTIL_IDLE_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "scroll",
] as const

export type DeferUntilIdleTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">

export type DeferUntilIdleScheduler = {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (id: number) => void
  setTimeoutFn?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void
}

export type DeferUntilIdleOptions = DeferUntilIdleScheduler & {
  timeoutMs?: number
  target?: DeferUntilIdleTarget
}

/**
 * Run `callback` once after `requestIdleCallback`, the first user interaction, or a
 * timeout — whichever comes first. Returns a cancel function that prevents a later run.
 */
export function deferUntilIdleOrInteraction(
  callback: () => void,
  options: DeferUntilIdleOptions = {},
): () => void {
  const target = options.target ?? (typeof window === "undefined" ? null : window)
  if (!target) return () => {}

  let settled = false
  const timeoutMs = options.timeoutMs ?? DEFER_UNTIL_IDLE_TIMEOUT_MS
  const requestIdle =
    options.requestIdleCallback ??
    (typeof window !== "undefined" ? window.requestIdleCallback?.bind(window) : undefined)
  const cancelIdle =
    options.cancelIdleCallback ??
    (typeof window !== "undefined" ? window.cancelIdleCallback?.bind(window) : undefined)
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout

  const teardowns: Array<() => void> = []

  const cleanup = (): void => {
    while (teardowns.length > 0) {
      teardowns.pop()?.()
    }
  }

  const run = (): void => {
    if (settled) return
    settled = true
    cleanup()
    callback()
  }

  for (const event of DEFER_UNTIL_IDLE_EVENTS) {
    target.addEventListener(event, run, { once: true, passive: true })
    teardowns.push(() => target.removeEventListener(event, run))
  }

  if (typeof requestIdle === "function") {
    const idleId = requestIdle(run, { timeout: timeoutMs })
    if (typeof cancelIdle === "function") {
      teardowns.push(() => cancelIdle(idleId))
    }
  }

  const timeoutId = setTimeoutFn(run, timeoutMs)
  teardowns.push(() => clearTimeoutFn(timeoutId))

  return () => {
    if (settled) return
    settled = true
    cleanup()
  }
}
