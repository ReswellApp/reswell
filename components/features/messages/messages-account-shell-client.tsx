"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useFlatMobileMessagesInbox } from "@/hooks/use-flat-mobile-messages-inbox"
import { MessagesAccountMobileChrome } from "@/components/features/messages/messages-account-mobile-chrome"
import { isMessageThreadDetailRoute } from "@/lib/utils/message-thread-routes"
import { cn } from "@/lib/utils"

interface MessagesAccountShellClientProps {
  sellerProfileHref: string | null
  sidebar: ReactNode
  children: ReactNode
}

export function MessagesAccountShellClient({
  sellerProfileHref,
  sidebar,
  children,
}: MessagesAccountShellClientProps) {
  const flatMobileInbox = useFlatMobileMessagesInbox()
  const pathname = usePathname()
  // On a conversation thread the mobile layout becomes a full-bleed, full-height
  // app shell: drop the account container's gutters, vertical padding, and the
  // chrome gap so the thread fills the locked viewport edge-to-edge.
  const threadDetail = isMessageThreadDetailRoute(pathname)

  return (
    <div
      className={cn(
        "container mx-auto flex flex-col py-6 sm:py-8",
        flatMobileInbox ? "min-h-0 flex-none" : "min-h-0 flex-1",
        threadDetail && "max-lg:max-w-none max-lg:px-0 max-lg:py-0",
      )}
    >
      <MessagesAccountMobileChrome sellerProfileHref={sellerProfileHref} />

      <div
        className={cn(
          "mt-6 flex flex-col gap-8 lg:mt-0 lg:flex-row lg:gap-12 xl:gap-14",
          flatMobileInbox ? "flex-none" : "min-h-0 flex-1",
          threadDetail && "max-lg:mt-0 max-lg:gap-0",
        )}
      >
        {sidebar}
        <div className={cn(flatMobileInbox ? "flex flex-col" : "flex min-h-0 min-w-0 flex-1 flex-col")}>
          {children}
        </div>
      </div>
    </div>
  )
}
