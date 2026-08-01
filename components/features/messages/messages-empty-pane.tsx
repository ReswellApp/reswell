"use client"

import Link from "next/link"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface MessagesEmptyPaneProps {
  variant?: "pane" | "banner"
  className?: string
}

export function MessagesEmptyPane({ variant = "pane", className }: MessagesEmptyPaneProps) {
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left",
          className,
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground">Select a conversation</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            Choose a chat from the list below to view messages and reply.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center px-6 pt-10 text-center lg:items-start lg:px-8 lg:pt-8 lg:text-left",
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="text-[17px] font-semibold text-foreground">Select a conversation</p>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        Choose a marketplace chat from the list to view messages and reply. For help from
        Reswell, open{" "}
        <Link
          href="/dashboard/support"
          className="text-primary underline underline-offset-2"
        >
          Support
        </Link>
        .
      </p>
    </div>
  )
}
