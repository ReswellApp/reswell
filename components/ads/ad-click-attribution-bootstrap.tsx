"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { adAttributionCookieHeader, parseAdAttributionFromSearch } from "@/lib/ads/attribution"

/**
 * Last-click ad attribution: when a landing URL has gclid, fbclid, or UTMs,
 * persist them in a first-party cookie so checkout can stamp the order.
 */
export function AdClickAttributionBootstrap(): null {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const searchString = searchParams.toString()

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/")) return
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return
    if (typeof document === "undefined") return

    const snapshot = parseAdAttributionFromSearch({
      search: new URLSearchParams(searchString),
      pathname,
    })
    if (!snapshot) return

    document.cookie = adAttributionCookieHeader(snapshot, window.location.protocol === "https:")
  }, [pathname, searchString])

  return null
}
