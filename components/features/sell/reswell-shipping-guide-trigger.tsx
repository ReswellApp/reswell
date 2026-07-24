"use client"

import { CircleHelp } from "lucide-react"
import type { ReswellShippingGuideTopicId } from "@/lib/reswell-shipping-guide"
import { cn } from "@/lib/utils"

export type ReswellShippingGuideTriggerProps = {
  topicId: ReswellShippingGuideTopicId
  onOpen: (topicId: ReswellShippingGuideTopicId) => void
  /** Accessible name — defaults to “Learn more about …” from topicId. */
  label?: string
  className?: string
  /** Larger text link style for section headers. */
  variant?: "icon" | "link"
}

export function ReswellShippingGuideTrigger({
  topicId,
  onOpen,
  label,
  className,
  variant = "icon",
}: ReswellShippingGuideTriggerProps) {
  const ariaLabel = label ?? "Learn more about Reswell shipping"

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpen(topicId)
        }}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-2 hover:text-primary",
          className,
        )}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {ariaLabel}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onOpen(topicId)
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <CircleHelp className="h-4 w-4" aria-hidden />
    </button>
  )
}
