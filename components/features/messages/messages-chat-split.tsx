"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessagesInboxListPane } from "@/components/features/messages/messages-inbox-list-pane"
import { useFlatMobileMessagesInbox } from "@/hooks/use-flat-mobile-messages-inbox"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import { cn } from "@/lib/utils"

interface MessagesChatSplitProps {
  activeConversationId?: string | null
  children: ReactNode
  className?: string
}

export function MessagesChatSplit({
  activeConversationId = null,
  children,
  className,
}: MessagesChatSplitProps) {
  const pathname = usePathname() ?? ""
  const flatMobileInbox = useFlatMobileMessagesInbox()
  const isDetailRoute =
    !!activeConversationId ||
    pathname.startsWith("/messages/with/") ||
    pathname.startsWith("/messages/new")

  return (
    <div
      className={cn(
        "flex flex-col",
        flatMobileInbox ? "flex-none" : "min-h-0 flex-1 overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col lg:flex-row",
          flatMobileInbox
            ? "flex-none gap-0"
            : cn(
                "min-h-0 flex-1 overflow-hidden bg-background",
                "lg:border-t lg:border-border/60",
              ),
          isDetailRoute && "max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-hidden",
        )}
      >
        <aside
          className={cn(
            "flex w-full flex-col",
            flatMobileInbox
              ? "flex-none overflow-visible"
              : "min-h-0 shrink-0 overflow-hidden lg:w-[min(100%,320px)] lg:border-r lg:border-border/60 xl:w-[min(100%,360px)]",
            isDetailRoute ? "hidden lg:flex" : "flex",
            !flatMobileInbox && "min-h-0",
          )}
        >
          <div
            className={cn(
              "hidden shrink-0 items-end justify-between gap-3 px-4 pb-2 pt-4 lg:flex",
              flatMobileInbox && "lg:hidden",
            )}
          >
            <h1 className="text-[28px] font-bold tracking-tight text-foreground">Messages</h1>
            <Link
              href={
                activeConversationId
                  ? helpHubHref({ conversationId: activeConversationId })
                  : helpHubHref()
              }
              className="pb-0.5 text-[15px] font-medium text-listingHeart hover:underline"
            >
              Help
            </Link>
          </div>
          <MessagesInboxListPane activeConversationId={activeConversationId} />
        </aside>

        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            !isDetailRoute ? "hidden lg:flex" : "flex",
          )}
        >
          {children}
        </section>
      </div>
    </div>
  )
}
