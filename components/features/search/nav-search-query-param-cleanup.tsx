"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Drops internal analytics marker `nq=1` from the address bar without a Next navigation,
 * so `/search` is not rendered twice (which would duplicate marketplace analytics events).
 */
export function NavSearchQueryParamCleanup() {
  const searchParams = useSearchParams()
  const strippedRef = useRef(false)

  useEffect(() => {
    if (strippedRef.current) return
    if (searchParams.get("nq") !== "1") return
    strippedRef.current = true
    const u = new URL(window.location.href)
    u.searchParams.delete("nq")
    window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`)
  }, [searchParams])

  return null
}
