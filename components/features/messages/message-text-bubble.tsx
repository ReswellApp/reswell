import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { MessageBubbleGroup } from "@/lib/utils/message-thread-grouping"

const BUBBLE_MAX_WIDTH =
  "max-w-[min(100%,18.5rem)] sm:max-w-[min(100%,20rem)] md:max-w-[min(100%,28rem)]"

function groupRadiusClass(isOwn: boolean, group: MessageBubbleGroup): string {
  if (isOwn) {
    switch (group) {
      case "first":
        return "rounded-[18px] rounded-br-[4px]"
      case "middle":
        return "rounded-[18px] rounded-r-[4px]"
      case "last":
      case "single":
        return "rounded-[18px] rounded-br-[4px]"
    }
  }
  switch (group) {
    case "first":
      return "rounded-[18px] rounded-bl-[4px]"
    case "middle":
      return "rounded-[18px] rounded-l-[4px]"
    case "last":
    case "single":
      return "rounded-[18px] rounded-bl-[4px]"
  }
}

export function messageTextBubbleClassName({
  isOwn,
  group = "single",
}: {
  isOwn: boolean
  group?: MessageBubbleGroup
}): string {
  return cn(
    BUBBLE_MAX_WIDTH,
    "px-3.5 py-[7px] sm:px-4 sm:py-2",
    isOwn ? "bg-listingHeart text-white" : "bg-[#E9E9EB] text-foreground dark:bg-[#3A3A3C]",
    groupRadiusClass(isOwn, group),
  )
}

interface MessageTextBubbleProps {
  content: string
  isOwn: boolean
  group?: MessageBubbleGroup
  title?: string
  className?: string
  children?: ReactNode
}

export function MessageTextBubble({
  content,
  isOwn,
  group = "single",
  title,
  className,
  children,
}: MessageTextBubbleProps) {
  return (
    <div
      title={title}
      suppressHydrationWarning
      className={cn(messageTextBubbleClassName({ isOwn, group }), className)}
    >
      {children ?? (
        <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.35] tracking-[-0.01em]">
          {content}
        </p>
      )}
    </div>
  )
}

export function messageThreadCanvasClassName(className?: string): string {
  return cn("bg-[#F5F5F7] dark:bg-[#1C1C1E]", className)
}
