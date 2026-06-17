"use client"

import { usePathname } from "next/navigation"
import { useMobileLg } from "@/hooks/use-mobile-lg"
import { isMessagesInboxIndexRoute } from "@/lib/utils/message-thread-routes"

/** Mobile `/messages` inbox: flat list on the page (no card module, page scroll). */
export function useFlatMobileMessagesInbox(): boolean {
  const pathname = usePathname()
  const isMobileLg = useMobileLg()
  return isMobileLg && isMessagesInboxIndexRoute(pathname)
}
