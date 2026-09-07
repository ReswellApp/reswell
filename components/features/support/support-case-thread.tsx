"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  sendSupportCaseAdminReplyAction,
  sendSupportCaseMemberReplyAction,
} from "@/lib/actions/supportCaseThread"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
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
}

function bubbleAlign(authorRole: SupportCaseThreadMessage["author_role"], viewer: "member" | "staff") {
  if (authorRole === "system") return "center"
  if (viewer === "member") return authorRole === "customer" ? "end" : "start"
  return authorRole === "agent" ? "end" : "start"
}

export function SupportCaseThread({
  caseId,
  messages: initial,
  canReply,
  role,
  closed = false,
  seedText,
}: SupportCaseThreadProps) {
  const [messages, setMessages] = useState(initial)
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (seedText) setDraft(seedText)
  }, [seedText])

  const ordered = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages],
  )

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
      setMessages((prev) => [
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-3">
        {ordered.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          ordered.map((message) => {
            const align = bubbleAlign(message.author_role, role)
            if (align === "center") {
              return (
                <p
                  key={message.id}
                  className="px-6 text-center text-[12px] leading-relaxed text-muted-foreground"
                >
                  {message.body}
                </p>
              )
            }
            const mine = align === "end"
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
                    mine ? "bg-foreground text-background" : "bg-muted text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
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
      ) : closed ? (
        <p className="shrink-0 border-t border-border/50 px-3 py-3 text-center text-[13px] text-muted-foreground">
          This case is closed.
        </p>
      ) : null}
    </div>
  )
}
