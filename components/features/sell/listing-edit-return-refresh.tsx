"use client"

import { startTransition, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { consumeListingEditReturn } from "@/lib/sell-flow/navigate-after-listing-save"

/**
 * After Save, the editor calls `history.back()`. Refresh the restored screen
 * once so the listing row the seller just wrote replaces the cached page.
 */
export function ListingEditReturnRefresh() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      if (!consumeListingEditReturn()) return
      startTransition(() => {
        router.refresh()
      })
    }

    refresh()
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      refresh()
    }
    window.addEventListener("pageshow", onPageShow)
    return () => window.removeEventListener("pageshow", onPageShow)
  }, [pathname, router])

  return null
}
