"use client"

import { useLiveUnreadSupportCount } from "@/components/features/support/use-live-unread-support-count"

export function LiveSupportUnreadValue({ initialCount }: { initialCount: number }) {
  const count = useLiveUnreadSupportCount(initialCount)
  return <>{count.toLocaleString()}</>
}
