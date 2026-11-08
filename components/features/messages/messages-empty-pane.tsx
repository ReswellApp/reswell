"use client"

import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { messageThreadCanvasClassName } from "@/components/features/messages/message-text-bubble"

interface MessagesEmptyPaneProps {
  variant?: "pane" | "banner"
  className?: string
}

export function MessagesEmptyPane({ variant = "pane", className }: MessagesEmptyPaneProps) {
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3 text-left",
          className,
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <MessageCircle className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">Select a conversation</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            Choose a chat from the list to view messages and reply.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center",
        messageThreadCanvasClassName(),
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-black/5 dark:bg-card dark:ring-white/10">
        <MessageCircle className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-[22px] font-semibold tracking-tight text-foreground">
        No conversation selected
      </p>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        Choose a chat from the list to send a message.
      </p>
    </div>
  )
}
