'use client'

import { parseBrowserSessionRoute } from '@/lib/auth/browser-session'

let installed = false

/**
 * API routes and server actions read `x-reswell-browser-session` to pick the correct
 * Supabase cookie name. Patched fetch attaches it from the visible URL (`/w/{uuid}/…`).
 */
export function installBrowserSessionFetch(): void {
  if (typeof window === 'undefined' || installed) return
  installed = true
  const orig = window.fetch.bind(window)
  window.fetch = function fetchWithBrowserSession(input: RequestInfo | URL, init?: RequestInit) {
    const id = parseBrowserSessionRoute(window.location.pathname)?.sessionId
    if (!id) {
      return orig(input, init)
    }
    const h = new Headers(init?.headers)
    if (!h.has('x-reswell-browser-session')) {
      h.set('x-reswell-browser-session', id)
    }
    return orig(input, { ...init, headers: h })
  }
}

if (typeof window !== 'undefined') {
  installBrowserSessionFetch()
}
