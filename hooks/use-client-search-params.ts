'use client'

import { usePathname } from 'next/navigation'
import { useMemo, useSyncExternalStore } from 'react'

/**
 * Read URL search params without opting into Next.js `useSearchParams()` Suspense.
 * Used in always-visible chrome (header) so navigation never replaces the full nav
 * with an empty Suspense fallback or leaves scroll-lock cleanup incomplete.
 *
 * Subscribes to `history.pushState` / `replaceState` and `popstate` so query-only
 * navigations (e.g. `/boards` ↔ `/boards?type=shortboard`) re-render the header.
 */
function getLocationSearchSnapshot(): string {
  if (typeof window === 'undefined') return ''
  return window.location.search
}

function getServerSearchSnapshot(): string {
  return ''
}

const urlSearchSubscribers = new Set<() => void>()
let historyPatched = false
let notifyScheduled = false

function notifyUrlSearchSubscribers() {
  if (notifyScheduled) return
  notifyScheduled = true
  // Defer so Next.js router history writes during useInsertionEffect
  // do not synchronously trigger useSyncExternalStore updates.
  queueMicrotask(() => {
    notifyScheduled = false
    urlSearchSubscribers.forEach((callback) => callback())
  })
}

function patchHistoryForSearchSubscriptions() {
  if (typeof window === 'undefined' || historyPatched) return

  window.addEventListener('popstate', notifyUrlSearchSubscribers)

  const { pushState, replaceState } = history
  if (typeof pushState !== 'function' || typeof replaceState !== 'function') {
    return
  }

  historyPatched = true

  history.pushState = function (...args) {
    const result = pushState.apply(this, args)
    notifyUrlSearchSubscribers()
    return result
  }
  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args)
    notifyUrlSearchSubscribers()
    return result
  }
}

function subscribeToLocationSearch(onStoreChange: () => void): () => void {
  patchHistoryForSearchSubscriptions()
  urlSearchSubscribers.add(onStoreChange)
  return () => {
    urlSearchSubscribers.delete(onStoreChange)
  }
}

export function useClientSearchParams(): URLSearchParams {
  const pathname = usePathname()
  const searchString = useSyncExternalStore(
    subscribeToLocationSearch,
    getLocationSearchSnapshot,
    getServerSearchSnapshot,
  )

  return useMemo(
    () => new URLSearchParams(searchString),
    [pathname, searchString],
  )
}
