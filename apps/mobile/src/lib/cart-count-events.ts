const listeners = new Set<() => void>()

/** Tell every cart ticker to reload after an add, remove, or checkout. */
export function notifyCartChanged(): void {
  for (const listener of listeners) listener()
}

export function subscribeCartChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
