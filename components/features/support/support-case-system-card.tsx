"use client"

import { format, isToday, isYesterday } from "date-fns"
import { CheckCircle2, LifeBuoy, MessageSquareText } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ParsedSupportCaseOpenedMessage,
  ParsedSupportCaseStatusMessage,
} from "@/lib/messages/parse-support-thread-message"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

export function SupportCaseOpenedCard({
  parsed,
  createdAt,
  className,
}: {
  parsed: ParsedSupportCaseOpenedMessage
  createdAt: string
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[22rem] sm:max-w-[26rem]", className)}>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border/50 bg-muted/30 px-4 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LifeBuoy className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Case opened
            </p>
            <p className="truncate text-sm font-medium text-foreground">{parsed.topicLabel}</p>
          </div>
        </div>
        <div className="space-y-3 px-4 py-3.5">
          <div className="flex items-start gap-2">
            <MessageSquareText
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {parsed.body}
            </p>
          </div>
          <p className="text-[11px] tabular-nums text-muted-foreground/80">
            {formatThreadTime(createdAt)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function SupportCaseStatusCard({
  parsed,
  createdAt,
  className,
}: {
  parsed: ParsedSupportCaseStatusMessage
  createdAt: string
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[22rem] sm:max-w-[24rem]", className)}>
      <div className="flex items-start gap-2.5 rounded-2xl border border-border/50 bg-muted/25 px-3.5 py-3 shadow-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Update from Reswell
          </p>
          <p className="text-sm leading-relaxed text-foreground">{parsed.line}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground/80">
            {formatThreadTime(createdAt)}
          </p>
        </div>
      </div>
    </div>
  )
}
