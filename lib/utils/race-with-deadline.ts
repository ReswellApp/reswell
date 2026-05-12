/** Thrown when `raceWithDeadline` exceeds `ms` before the promise settles. */
export class PromiseDeadlineError extends Error {
  constructor() {
    super('timed_out')
    this.name = 'PromiseDeadlineError'
  }
}

/**
 * Resolves/rejects with `promise`, or rejects with `PromiseDeadlineError` after `ms`.
 * Clears the timer when `promise` settles first.
 */
export async function raceWithDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new PromiseDeadlineError()), ms)
  })
  try {
    return await Promise.race([promise, deadline])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}
