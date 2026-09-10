"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  sendSupportCaseAdminReplyAction,
  sendSupportCaseMemberReplyAction,
} from "@/lib/actions/supportCaseThread"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import { isSupportStatusUpdateMessage } from "@/lib/messages/parse-support-thread-message"
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
  originalRequest?: { body: string; createdAt: string; name: string } | null
  staffNames?: Record<string, string>
}

function bubbleAlign(authorRole: SupportCaseThreadMessage["author_role"], viewer: "member" | "staff") {
  if (authorRole === "system") return "center"
  if (viewer === "member") return authorRole === "customer" ? "end" : "start"
  return authorRole === "agent" ? "end" : "start"
}

function authorLabel(
  message: SupportCaseThreadMessage,
  viewer: "member" | "staff",
  staffNames?: Record<string, string>,
): string {
  if (message.is_internal) return "Internal note"
  if (message.author_role === "system") return "System"
  if (message.author_role === "customer") return viewer === "member" ? "You" : "Customer"
  if (message.author_user_id && staffNames?.[message.author_user_id]) {
    return staffNames[message.author_user_id] ?? "Support"
  }
  return viewer === "staff" ? "You" : "Support"
}

export function SupportCaseThread({
  caseId,
  messages: initial,
  canReply,
  role,
  closed = false,
  seedText,
  originalRequest = null,
  staffNames,
}: SupportCaseThreadProps) {
  const [localMessages, setLocalMessages] = useState(initial)
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)
  const messages = canReply ? localMessages : initial

  useEffect(() => {
    if (canReply) setLocalMessages(initial)
  }, [canReply, initial])

  useEffect(() => {
    if (seedText) setDraft(seedText)
  }, [seedText])

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
    const hasCustomer = visible.some((message) => message.author_role === "customer" && !message.is_internal)
    if (hasCustomer || !originalRequest?.body.trim()) return visible
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
  }, [messages, role, originalRequest, caseId])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          role === "staff" ? "space-y-4 px-2 py-4" : "space-y-3 px-1 py-3",
        )}
      >
        {displayMessages.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          displayMessages.map((message) => {
            if (message.author_role === "system") {
              return (
                <p
                  key={message.id}
                  className="px-6 text-center text-[12px] leading-relaxed text-muted-foreground"
                >
                  {message.body}
                </p>
              )
            }

            const align = bubbleAlign(message.author_role, role)
            const mine = align === "end"
            const note = message.is_internal

            return (
              <div key={message.id} className={cn("flex", mine && !note ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    role === "staff"
                      ? "max-w-[82%] space-y-1 lg:max-w-[72%]"
                      : "max-w-[85%] space-y-1",
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
                    {authorLabel(message, role, staffNames)}
                    {" · "}
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                  <div
                    className={cn(
                      "px-3.5 py-2.5 leading-relaxed",
                      role === "staff" ? "text-sm" : "text-[15px]",
                      note
                        ? "rounded-lg border border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-50"
                        : mine
                          ? "rounded-2xl bg-foreground text-background"
                          : "rounded-2xl bg-muted text-foreground",
                    )}
                    title={format(new Date(message.created_at), "PPpp")}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {canReply && !closed ? (
        <div className="shrink-0 space-y-2 border-t border-border/60 bg-background px-1 py-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={role === "staff" ? "Reply to the customer…" : "Reply to Support…"}
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
      ) : closed && role === "staff" ? (
        <p className="shrink-0 border-t border-border/50 px-3 py-3 text-center text-[13px] text-muted-foreground">
          This case is closed.
        </p>
      ) : null}
    </div>
  )
}
