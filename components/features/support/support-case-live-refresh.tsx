"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLiveUnreadSupportCount } from "@/components/features/support/use-live-unread-support-count"

/**
 * Soft-refresh the open help thread when unread support count changes or
 * the tab becomes visible again — keeps the member conversation feeling live.
 */
export function SupportCaseLiveRefresh({
  initialUnreadCount = 0,
}: {
  initialUnreadCount?: number
}) {
  const router = useRouter()
  const count = useLiveUnreadSupportCount(initialUnreadCount)
  const previous = useRef(count)

  useEffect(() => {
    if (previous.current === count) return
    previous.current = count
    router.refresh()
  }, [count, router])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      router.refresh()
    }
    const interval = window.setInterval(onVisible, 45_000)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [router])

  return null
}
