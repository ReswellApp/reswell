type Slot<T> = { at: number; freshMs: number; value: T }

export type MemoryCacheLoadOptions = { force?: boolean; freshMs?: number }

export type MemoryCache<T> = {
  peek(key: string): T | null
  remember(key: string, value: T): void
  load(key: string, loader: () => Promise<T>, options?: MemoryCacheLoadOptions): Promise<T>
  forget(key: string): void
  clear(): void
}

const DEFAULT_FRESH_MS = 45_000
const DEFAULT_MAX_SLOTS = 32

/** In-memory TTL cache with in-flight dedupe. Fresh hits skip the loader; peek still returns stale. */
export function createMemoryCache<T>(options?: { freshMs?: number; maxSlots?: number }): MemoryCache<T> {
  const freshMs = options?.freshMs ?? DEFAULT_FRESH_MS
  const maxSlots = options?.maxSlots ?? DEFAULT_MAX_SLOTS
  const slots = new Map<string, Slot<T>>()
  const loads = new Map<string, Promise<T>>()

  function setSlot(key: string, value: T, slotFreshMs: number): void {
    slots.delete(key)
    slots.set(key, { at: Date.now(), freshMs: slotFreshMs, value })
    while (slots.size > maxSlots) {
      const oldest = slots.keys().next().value
      if (oldest === undefined) break
      slots.delete(oldest)
    }
  }

  function peek(key: string): T | null {
    if (!key) return null
    return slots.get(key)?.value ?? null
  }

  function remember(key: string, value: T): void {
    if (!key) return
    setSlot(key, value, freshMs)
  }

  function forget(key: string): void {
    slots.delete(key)
    loads.delete(key)
  }

  function clear(): void {
    slots.clear()
    loads.clear()
  }

  function load(key: string, loader: () => Promise<T>, options?: MemoryCacheLoadOptions): Promise<T> {
    const force = Boolean(options?.force)
    const slotFreshMs = options?.freshMs ?? freshMs
    if (!force) {
      const pending = loads.get(key)
      if (pending) return pending
      const slot = slots.get(key)
      if (slot && Date.now() - slot.at < slot.freshMs) return Promise.resolve(slot.value)
    }

    let loadPromise: Promise<T>
    loadPromise = loader()
      .then((value) => {
        setSlot(key, value, slotFreshMs)
        return value
      })
      .catch((error: unknown) => {
        if (loads.get(key) === loadPromise) loads.delete(key)
        throw error
      })
    loads.set(key, loadPromise)
    void loadPromise.then(
      () => {
        if (loads.get(key) === loadPromise) loads.delete(key)
      },
      () => undefined,
    )
    return loadPromise
  }

  return { peek, remember, load, forget, clear }
}
