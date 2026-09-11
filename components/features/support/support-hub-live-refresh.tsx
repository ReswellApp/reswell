"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLiveUnreadSupportCount } from "@/components/features/support/use-live-unread-support-count"

export function SupportHubLiveRefresh({ initialCount }: { initialCount: number }) {
  const router = useRouter()
  const count = useLiveUnreadSupportCount(initialCount)
  const previous = useRef(count)

  useEffect(() => {
    if (previous.current === count) return
    previous.current = count
    router.refresh()
  }, [count, router])

  return null
}
