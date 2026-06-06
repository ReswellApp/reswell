"use client"

/**
 * Global serializer for CPU-heavy client image work (HEIC decode, canvas resize/encode).
 *
 * The sell flows kick off processing for every selected photo at once. Without a limiter those
 * synchronous canvas / wasm steps run concurrently on the main thread and freeze scrolling on
 * mobile. Capping concurrency leaves gaps for the browser to paint and respond to touch between
 * images. Off-main-thread work (the OffscreenCanvas worker) does not need this gate.
 */

function resolveMaxConcurrency(): number {
  if (typeof navigator === "undefined") return 1
  const cores = navigator.hardwareConcurrency
  if (typeof cores === "number" && cores >= 8) return 2
  return 1
}

const MAX_CONCURRENCY = resolveMaxConcurrency()

let activeCount = 0
const waiting: Array<() => void> = []

function releaseSlot(): void {
  activeCount -= 1
  const next = waiting.shift()
  if (next) next()
}

/** Runs `task` once a CPU slot is free; resolves/rejects with the task result. */
export function runImageCpuTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeCount += 1
      task().then(
        (value) => {
          releaseSlot()
          resolve(value)
        },
        (error) => {
          releaseSlot()
          reject(error)
        },
      )
    }

    if (activeCount < MAX_CONCURRENCY) {
      start()
    } else {
      waiting.push(start)
    }
  })
}
