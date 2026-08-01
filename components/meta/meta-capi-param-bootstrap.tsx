"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { primeMetaBrowserSignals } from "@/lib/meta/collect-client-browser-signals"

/**
 * Runs Meta's client Parameter Builder on each navigation so `_fbc` / `_fbp` cookies
 * capture `fbclid` before ViewContent / AddToCart server events fire.
 */
export function MetaCapiParamBootstrap(): null {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const searchString = searchParams.toString()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/")) return
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return

    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${pathname}${searchString ? `?${searchString}` : ""}`
        : null

    void primeMetaBrowserSignals(url).catch(() => {})

    if (isFirstRender.current) {
      isFirstRender.current = false
    }
  }, [pathname, searchString])

  return null
}
