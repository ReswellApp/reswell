"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"

function KlaviyoPageViewTrackerInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastKey = useRef<string>("")

  useEffect(() => {
    const search = searchParams?.toString()
    const path = search ? `${pathname}?${search}` : pathname
    const key = `${path}::${typeof window !== "undefined" ? window.location.href : ""}`
    if (key === lastKey.current) return
    lastKey.current = key

    const href = typeof window !== "undefined" ? window.location.href : ""
    void fetch("/api/integrations/klaviyo/page-view", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, href }),
    }).catch(() => {})
  }, [pathname, searchParams])

  return null
}

export function KlaviyoPageViewTracker() {
  return (
    <Suspense fallback={null}>
      <KlaviyoPageViewTrackerInner />
    </Suspense>
  )
}
