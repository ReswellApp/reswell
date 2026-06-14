"use client"

/**
 * Concurrency gates for client-side image work (HEIC decode, canvas resize/encode, OffscreenCanvas
 * worker prepare).
 *
 * The sell flows kick off processing for every selected photo at once. Two distinct problems follow:
 *
 *  1. Main-thread CPU work (HEIC wasm, canvas resize/encode) run concurrently freezes scrolling on
 *     mobile. {@link runImageCpuTask} caps that work so the browser can paint/respond between images.
 *
 *  2. Peak *memory* — decoding many full-resolution photos (`createImageBitmap`) at the same time —
 *     is what makes iOS Safari throw `DOMException: "The operation was aborted"`. This happens on the
 *     OffscreenCanvas worker path too, which is otherwise off the main thread. {@link runImagePrepareTask}
 *     bounds how many photos are decoded/encoded in flight at once, across both the worker and the
 *     main-thread fallback, so a batch of large iPhone photos never triggers an out-of-memory abort.
 */

function resolveMaxConcurrency(): number {
  if (typeof navigator === "undefined") return 1
  const cores = navigator.hardwareConcurrency
  if (typeof cores === "number" && cores >= 8) return 2
  return 1
}

type Semaphore = {
  run: <T>(task: () => Promise<T>) => Promise<T>
}

function createSemaphore(maxConcurrency: number): Semaphore {
  const limit = Math.max(1, maxConcurrency)
  let activeCount = 0
  const waiting: Array<() => void> = []

  const release = () => {
    activeCount -= 1
    const next = waiting.shift()
    if (next) next()
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          activeCount += 1
          task().then(
            (value) => {
              release()
              resolve(value)
            },
            (error) => {
              release()
              reject(error)
            },
          )
        }

        if (activeCount < limit) {
          start()
        } else {
          waiting.push(start)
        }
      })
    },
  }
}

const MAX_CONCURRENCY = resolveMaxConcurrency()

const cpuQueue = createSemaphore(MAX_CONCURRENCY)

/**
 * Memory gate for full-resolution decode/encode. Kept separate from {@link runImageCpuTask} so the
 * two never deadlock when the main-thread prepare path (gated here) internally schedules CPU work.
 */
const prepareQueue = createSemaphore(MAX_CONCURRENCY)

/** Runs `task` once a CPU slot is free; resolves/rejects with the task result. */
export function runImageCpuTask<T>(task: () => Promise<T>): Promise<T> {
  return cpuQueue.run(task)
}

/**
 * Runs `task` once a memory slot is free. Use for the whole decode→encode of one photo so a batch of
 * large images is processed without an out-of-memory abort on mobile Safari.
 */
export function runImagePrepareTask<T>(task: () => Promise<T>): Promise<T> {
  return prepareQueue.run(task)
}
