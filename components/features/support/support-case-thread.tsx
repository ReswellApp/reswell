"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format } from "date-fns"
import { RelativeTime } from "@/components/ui/relative-time"
import { formatDeskTime } from "@/lib/utils/format-local-thread-time"
import { LifeBuoy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  sendSupportCaseAdminReplyAction,
  sendSupportCaseMemberReplyAction,
} from "@/lib/actions/supportCaseThread"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { isSupportStatusUpdateMessage } from "@/lib/messages/parse-support-thread-message"
import { displaySupportCaseSystemBody, SUPPORT_DESK_NAME } from "@/lib/utils/support-case-display"
import { normalizedSupportMessageBody } from "@/lib/utils/support-case-thread-history"
import { mergeThreadMessagesWithPendingLocal } from "@/lib/admin/case-inbox-thread-merge"
import { MessageComposerBar } from "@/components/features/messages/message-composer-bar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type SupportCaseThreadProps = {
  caseId: string
  messages: SupportCaseThreadMessage[]
  canReply: boolean
  role: "member" | "staff"
  closed?: boolean
  seedText?: string
  /** fill-empty keeps an in-progress reply; replace is for macros / rewrite. */
  seedMode?: "fill-empty" | "replace"
  originalRequest?: { body: string; createdAt: string; name: string } | null
  staffNames?: Record<string, string>
  /** Case requester — used so staff-authored rows stay on the agent side. */
  requesterUserId?: string | null
  counterpartLabel?: string
}

/** Staff/agent replies → right for staff viewers; customer → left. */
function messageIsFromAgent(
  message: SupportCaseThreadMessage,
  staffNames?: Record<string, string>,
  requesterUserId?: string | null,
): boolean {
  if (message.author_role === "agent") return true
  if (message.author_role === "system" || message.is_internal) return false
  // Mis-tagged staff rows still belong on the agent side.
  if (
    message.author_user_id &&
    staffNames?.[message.author_user_id] &&
    message.author_user_id !== requesterUserId
  ) {
    return true
  }
  return false
}

function bubbleAlign(
  message: SupportCaseThreadMessage,
  viewer: "member" | "staff",
  staffNames?: Record<string, string>,
  requesterUserId?: string | null,
) {
  if (message.author_role === "system") return "center"
  const fromAgent = messageIsFromAgent(message, staffNames, requesterUserId)
  if (viewer === "member") return fromAgent ? "start" : "end"
  return fromAgent ? "end" : "start"
}

function authorLabel(
  message: SupportCaseThreadMessage,
  viewer: "member" | "staff",
  staffNames?: Record<string, string>,
  counterpartLabel = "Member",
  requesterUserId?: string | null,
): string {
  if (message.is_internal) return "Internal note"
  if (message.author_role === "system") return "System"
  if (messageIsFromAgent(message, staffNames, requesterUserId)) {
    if (message.author_user_id && staffNames?.[message.author_user_id]) {
      return staffNames[message.author_user_id] ?? "Support"
    }
    return viewer === "staff" ? "You" : "Support"
  }
  return viewer === "member" ? "You" : counterpartLabel
}

export function SupportCaseThread({
  caseId,
  messages: initial,
  canReply,
  role,
  closed = false,
  seedText,
  seedMode = "replace",
  originalRequest = null,
  staffNames,
  requesterUserId = null,
  counterpartLabel = "Member",
}: SupportCaseThreadProps) {
  const [localMessages, setLocalMessages] = useState(initial)
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)
  const messages = canReply ? localMessages : initial

  useEffect(() => {
    if (!canReply) return
    setLocalMessages((prev) => mergeThreadMessagesWithPendingLocal(prev, initial))
  }, [canReply, initial])

  useEffect(() => {
    if (!seedText) return
    if (seedMode === "fill-empty") {
      setDraft((prev) => (prev.trim() ? prev : seedText))
      return
    }
    setDraft(seedText)
  }, [seedText, seedMode])

  const displayMessages = useMemo(() => {
    const live = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    const withoutWorkflowEvents = live.filter(
      (message) =>
        !(message.author_role === "system" && isSupportStatusUpdateMessage(message.body)),
    )
    const visible =
      role === "staff"
        ? withoutWorkflowEvents
        : withoutWorkflowEvents.filter((message) => !message.is_internal)
    const hasCustomer = visible.some(
      (message) =>
        !message.is_internal &&
        !messageIsFromAgent(message, staffNames, requesterUserId) &&
        message.author_role !== "system",
    )
    const opening = normalizedSupportMessageBody(originalRequest?.body ?? "")
    const openingMatchesAgent = visible.some(
      (message) =>
        messageIsFromAgent(message, staffNames, requesterUserId) &&
        normalizedSupportMessageBody(message.body) === opening,
    )
    if (hasCustomer || !opening || openingMatchesAgent || !originalRequest) return visible
    return [
      {
        id: `original-${caseId}`,
        case_id: caseId,
        author_user_id: null,
        author_role: "customer" as const,
        body: originalRequest.body,
        is_internal: false,
        created_at: originalRequest.createdAt,
      },
      ...visible,
    ]
  }, [messages, role, originalRequest, caseId, staffNames, requesterUserId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const frame = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [displayMessages.length, caseId])

  function send() {
    const content = draft.trim()
    if (!content) {
      toast.error("Write a message first.")
      return
    }
    startTransition(async () => {
      const res =
        role === "staff"
          ? await sendSupportCaseAdminReplyAction({ case_id: caseId, content })
          : await sendSupportCaseMemberReplyAction({ case_id: caseId, content })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      setLocalMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          case_id: caseId,
          author_user_id: null,
          author_role: role === "staff" ? "agent" : "customer",
          body: content,
          is_internal: false,
          created_at: new Date().toISOString(),
        },
      ])
      setDraft("")
    })
  }

  const member = role === "member"

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden",
          member ? "px-3 py-4" : "space-y-3 px-2 py-3",
        )}
      >
        <div className={cn(member ? "mt-auto flex flex-col gap-3" : "space-y-3")}>
        {displayMessages.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          displayMessages.map((message) => {
            if (message.author_role === "system") {
              return (
                <p
                  key={message.id}
                  className="mx-auto max-w-[22rem] rounded-full bg-muted/70 px-3 py-1.5 text-center text-[12px] leading-relaxed text-muted-foreground"
                >
                  {displaySupportCaseSystemBody(message.body)}
                </p>
              )
            }

            const align = bubbleAlign(message, role, staffNames, requesterUserId)
            const mine = align === "end"
            const note = message.is_internal
            const fromSupport = messageIsFromAgent(message, staffNames, requesterUserId)

            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  mine && !note ? "justify-end" : "justify-start",
                )}
              >
                {member && fromSupport && !note ? (
                  <span
                    className="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-listingHeart text-white"
                    aria-hidden
                  >
                    <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                ) : null}
                <div
                  className={cn(
                    role === "staff"
                      ? "max-w-[82%] space-y-1 lg:max-w-[72%]"
                      : "max-w-[min(85%,20rem)] space-y-1 sm:max-w-[22rem]",
                    note && "w-full max-w-none",
                  )}
                >
                  <p
                    className={cn(
                      "px-1 text-[11px] font-medium",
                      note
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-muted-foreground",
                      mine && !note && "text-right",
                    )}
                  >
                    {member && fromSupport
                      ? SUPPORT_DESK_NAME
                      : authorLabel(
                          message,
                          role,
                          staffNames,
                          counterpartLabel,
                          requesterUserId,
                        )}
                    {" · "}
                    <RelativeTime iso={message.created_at} formatLabel={formatDeskTime} />
                  </p>
                  <div
                    className={cn(
                      "px-3.5 py-2.5 leading-relaxed",
                      role === "staff" ? "text-sm" : "text-[15px]",
                      note
                        ? "rounded-lg border border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-50"
                        : role === "staff" && mine
                          ? "rounded-2xl bg-indigo-50 text-foreground dark:bg-indigo-950/50 dark:text-indigo-50"
                          : role === "staff"
                            ? "rounded-2xl border border-border/60 bg-background text-foreground shadow-sm"
                            : mine
                              ? "rounded-2xl bg-foreground text-background"
                              : "rounded-2xl border border-listingHeart/15 bg-listingHeart/[0.08] text-foreground",
                    )}
                    title={format(new Date(message.created_at), "PPpp")}
                    suppressHydrationWarning
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        </div>
      </div>

      {canReply && !closed ? (
        member ? (
          <div className="shrink-0 border-t border-border/60 bg-background px-3 py-3">
            <MessageComposerBar
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onSubmit={send}
              sending={pending}
              showMedia={false}
              placeholder={`Reply to ${SUPPORT_DESK_NAME}`}
            />
          </div>
        ) : (
          <div className="shrink-0 space-y-2 border-t border-border/60 bg-background px-1 py-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={`Reply to the ${counterpartLabel.toLowerCase()}…`}
              className="resize-y text-sm"
              maxLength={12000}
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={send} disabled={pending || !draft.trim()}>
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Send
              </Button>
            </div>
          </div>
        )
      ) : closed ? (
        <p className="shrink-0 border-t border-border/50 px-3 py-3 text-center text-[13px] text-muted-foreground">
          This conversation is closed. Start a new one from Help anytime.
        </p>
      ) : null}
    </div>
  )
}
