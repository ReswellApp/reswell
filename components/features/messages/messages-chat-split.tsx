"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessagesInboxListPane } from "@/components/features/messages/messages-inbox-list-pane"
import { useFlatMobileMessagesInbox } from "@/hooks/use-flat-mobile-messages-inbox"
import {
  dashboardPageSubtitleClass,
  dashboardPageTitleClass,
} from "@/lib/utils/dashboard-display-styles"
import { helpHubHref } from "@/lib/help/help-hub-intents"
import { Button } from "@/components/ui/button"
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
        flatMobileInbox ? "flex-none" : "min-h-0 flex-1",
        className,
      )}
    >
      <header className="mb-4 hidden shrink-0 flex-col gap-3 lg:flex lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className={dashboardPageTitleClass}>Messages</h1>
          <p className={dashboardPageSubtitleClass}>
            Marketplace chats with buyers and sellers. Help cases with Reswell live under{" "}
            <Link
              href="/dashboard/support"
              className="text-primary underline underline-offset-2"
            >
              Help
            </Link>
            , not here.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2 rounded-full shrink-0">
          <Link
            href={
              activeConversationId
                ? helpHubHref({ conversationId: activeConversationId })
                : helpHubHref()
            }
          >
            Get help
          </Link>
        </Button>
      </header>

      <div
        className={cn(
          "flex flex-col lg:flex-row",
          flatMobileInbox
            ? "flex-none gap-0"
            : cn(
                "min-h-0 flex-1 overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)]",
                "min-h-[min(72dvh,720px)] lg:min-h-0",
              ),
          isDetailRoute &&
            "max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none",
        )}
      >
        <aside
          className={cn(
            "flex w-full flex-col",
            flatMobileInbox
              ? "flex-none overflow-visible"
              : "min-h-0 shrink-0 flex-col overflow-hidden border-border/60 lg:w-[min(100%,340px)] lg:border-r xl:w-[min(100%,380px)]",
            isDetailRoute ? "hidden lg:flex" : "flex",
            !flatMobileInbox && "min-h-0",
          )}
        >
          <MessagesInboxListPane activeConversationId={activeConversationId} />
        </aside>

        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            !isDetailRoute ? "hidden lg:flex" : "flex",
          )}
        >
          {children}
        </section>
      </div>
    </div>
  )
}
