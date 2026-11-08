"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useFlatMobileMessagesInbox } from "@/hooks/use-flat-mobile-messages-inbox"
import { MessagesAccountMobileChrome } from "@/components/features/messages/messages-account-mobile-chrome"
import { isMessageThreadDetailRoute } from "@/lib/utils/message-thread-routes"
import { cn } from "@/lib/utils"

interface MessagesAccountShellClientProps {
  sellerProfileHref: string | null
  isAdmin?: boolean
  isShipper?: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess: boolean
  children: ReactNode
}

export function MessagesAccountShellClient({
  sellerProfileHref,
  isAdmin = false,
  isShipper = false,
  isDropoffLocation = false,
  hasShopifyAccess,
  children,
}: MessagesAccountShellClientProps) {
  const flatMobileInbox = useFlatMobileMessagesInbox()
  const pathname = usePathname()
  const threadDetail = isMessageThreadDetailRoute(pathname)

  return (
    <div
      className={cn(
        "flex flex-col",
        flatMobileInbox
          ? "min-h-0 flex-none px-4 py-6 sm:px-6"
          : "h-full min-h-0 flex-1 overflow-hidden",
        threadDetail && "max-lg:px-0 max-lg:py-0",
      )}
    >
      <MessagesAccountMobileChrome
        sellerProfileHref={sellerProfileHref}
        isAdmin={isAdmin}
        isShipper={isShipper}
        isDropoffLocation={isDropoffLocation}
        hasShopifyAccess={hasShopifyAccess}
      />

      <div
        className={cn(
          "flex min-w-0 flex-col",
          flatMobileInbox
            ? "mt-4 flex-none"
            : cn("min-h-0 flex-1 overflow-hidden", threadDetail ? "max-lg:mt-0" : "lg:mt-0"),
        )}
      >
        {children}
      </div>
    </div>
  )
}
