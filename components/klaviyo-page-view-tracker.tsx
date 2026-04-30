"use client"

import { usePathname, useSearchParams } from "next/navigation"
import React, { useEffect } from "react"

const STORAGE_KEY = "rw_klaviyo_anon_id"

function getOrCreateAnonymousId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`
  }
}

/**
 * Sends a Klaviyo event on each App Router navigation (including first paint).
 * Skips `/admin` routes entirely.
 * Logged-out users need `anonymous_id` → stable id in localStorage.
 */
export function KlaviyoPageViewTracker(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams?.toString() ?? ""

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/")) return
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return

    const anonId = getOrCreateAnonymousId()
    void fetch("/api/integrations/klaviyo/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        pathname,
        ...(searchString ? { search: searchString } : {}),
        anonymous_id: anonId,
      }),
    }).catch(() => {})
  }, [pathname, searchString])

  return null
}
