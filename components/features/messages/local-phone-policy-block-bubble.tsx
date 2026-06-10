"use client"

import { MessagesSupportDialog } from "@/components/features/messages/messages-support-dialog"
import { getMessagePolicyNotice } from "@/lib/messages/phone-policy-notice"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { cn } from "@/lib/utils"

type Align = "thread" | "inline"

interface LocalPhonePolicyBlockBubbleProps {
  originalContent: string
  reasonCode?: MessagePolicyReasonCode
  formattedTime?: string
  /** Links the support ticket to this marketplace thread when present. */
  relatedConversationId?: string | null
  align?: Align
  className?: string
}

export function LocalPhonePolicyBlockBubble({
  originalContent,
  reasonCode = "phone_like",
  formattedTime,
  relatedConversationId = null,
  align = "thread",
  className,
}: LocalPhonePolicyBlockBubbleProps) {
  const isThread = align === "thread"
  const notice = getMessagePolicyNotice(reasonCode)

  return (
    <div
      className={cn(
        "flex w-full",
        isThread ? "justify-end" : "justify-stretch",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[20px] border border-amber-500/35 bg-amber-50/90 px-3.5 py-2.5 text-foreground shadow-sm dark:border-amber-500/25 dark:bg-amber-950/40 sm:px-4 sm:py-3",
          isThread
            ? "max-w-[min(100%,18.5rem)] rounded-br-[6px] sm:max-w-[min(100%,20rem)] md:max-w-[min(100%,28rem)]"
            : "w-full max-w-none rounded-2xl",
        )}
      >
        <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.35] tracking-[-0.01em] text-foreground/95">
          {originalContent}
        </p>

        <div
          className={cn(
            "my-2.5 border-t border-amber-600/20 dark:border-amber-400/20",
            isThread ? "mx-0" : "",
          )}
        />

        <p className="text-[13px] font-semibold leading-snug text-amber-950 dark:text-amber-100">
          {notice.heading}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-amber-950/90 dark:text-amber-50/90">
          {notice.body}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MessagesSupportDialog
            relatedConversationId={relatedConversationId}
            triggerMode="default"
            triggerLabel="Get help"
            size="sm"
            variant="outline"
            triggerClassName="h-8 border-amber-700/25 bg-background/80 text-[13px] text-foreground hover:bg-background dark:border-amber-400/25"
          />
        </div>

        {formattedTime ? (
          <p className="mt-2 text-[11px] tabular-nums leading-none text-amber-900/55 dark:text-amber-200/55">
            Not sent · {formattedTime}
          </p>
        ) : (
          <p className="mt-2 text-[11px] tabular-nums leading-none text-amber-900/55 dark:text-amber-200/55">
            Not sent
          </p>
        )}
      </div>
    </div>
  )
}
