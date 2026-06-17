"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { MessagesInboxListPane } from "@/components/features/messages/messages-inbox-list-pane"
import { MessagesEmptyPane } from "@/components/features/messages/messages-empty-pane"
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
  const isDetailRoute =
    !!activeConversationId ||
    pathname.startsWith("/messages/with/") ||
    pathname.startsWith("/messages/new")
  const isInboxIndex = pathname.replace(/\/$/, "") === "/messages"

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", isDetailRoute && "h-full", className)}>
      {isInboxIndex && !isDetailRoute ? (
        <MessagesEmptyPane variant="banner" className="mb-4 lg:hidden" />
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)]",
          isDetailRoute
            ? "h-full min-h-0 max-lg:rounded-none max-lg:border-0 max-lg:shadow-none"
            : "min-h-[min(72dvh,720px)] lg:min-h-[min(68dvh,680px)]",
        )}
      >
        <aside
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-border/60 lg:w-[min(100%,340px)] lg:border-r xl:w-[min(100%,380px)]",
            isDetailRoute ? "hidden lg:flex" : "flex",
          )}
        >
          <MessagesInboxListPane activeConversationId={activeConversationId} />
        </aside>

        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            !isDetailRoute ? "hidden lg:flex" : "flex h-full min-h-0",
          )}
        >
          {children}
        </section>
      </div>
    </div>
  )
}
