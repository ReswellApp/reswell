/** Thrown when an upload reports no byte progress for longer than the stall window. */
export class UploadStallError extends Error {
  constructor(message = "Upload stalled. Check your connection and try again.") {
    super(message)
    this.name = "UploadStallError"
  }
}

/**
 * Watchdog for XHR / fetch uploads that go silent without erroring
 * (common on iOS Safari and flaky cellular).
 */
export function createUploadStallWatch(opts: {
  stallMs: number
  onStall: () => void
}): { ping: () => void; stop: () => void } {
  const stallMs = Math.max(1, opts.stallMs)
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const stop = () => {
    stopped = true
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const ping = () => {
    if (stopped) return
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      if (stopped) return
      stopped = true
      timer = undefined
      opts.onStall()
    }, stallMs)
  }

  ping()
  return { ping, stop }
}
