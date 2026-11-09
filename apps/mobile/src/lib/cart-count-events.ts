export type CartChangedDetail = {
  /** When set, header badge updates immediately without waiting on GET /me/cart. */
  itemCount?: number
}

const listeners = new Set<(detail?: CartChangedDetail) => void>()

/** Tell every cart ticker to refresh after an add, remove, or checkout. */
export function notifyCartChanged(detail?: CartChangedDetail): void {
  for (const listener of listeners) listener(detail)
}

export function subscribeCartChanged(listener: (detail?: CartChangedDetail) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
