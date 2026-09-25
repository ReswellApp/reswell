"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { askEmailStudioAssistantAction } from "@/lib/actions/emailStudioFlows"
import type { EmailStudioDocument } from "@/lib/types/emailStudio"
import type { EmailStudioMessage } from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"

export function EmailStudioAssistant({
  scope,
  scopeId,
  enabled,
  initialMessages,
  snapshot,
  onEmail,
}: {
  scope: "email" | "flow"
  scopeId: string
  enabled: boolean
  initialMessages: EmailStudioMessage[]
  snapshot: string
  onEmail?: (email: { subject: string; previewText: string; notes: string; document: EmailStudioDocument }) => void
}) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)

  async function send() {
    const message = text.trim()
    if (!message || pending) return
    setPending(true)
    setText("")
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString() },
    ])
    const result = await askEmailStudioAssistantAction({ scope, scopeId, message, snapshot })
    setPending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "assistant", content: result.reply, createdAt: new Date().toISOString() },
    ])
    if (result.email && onEmail) {
      onEmail(result.email)
      toast.success("Draft applied. Save when it looks right.")
    }
    if (result.flowId && result.flowId !== scopeId) {
      toast.success("Flow draft is ready.")
      router.push(`/admin/email-studio/flows/${result.flowId}`)
    } else if (result.flowId) {
      toast.success("Flow updated.")
      router.refresh()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assistant</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ask for a subject, a rewrite, or a whole flow with delays and a trigger. Nothing sends until you push it.
          </p>
        ) : null}
        {messages.map((message) => (
          <p key={message.id} className={`text-sm ${message.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
            {message.content}
          </p>
        ))}
      </div>
      <textarea
        value={text}
        aria-label="Message the assistant"
        placeholder={enabled ? "Rewrite the headline, or build a 2-email flow" : "Assistant is off until the AI gateway key is set"}
        disabled={!enabled || pending}
        className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void send()
          }
        }}
      />
      <Button size="sm" disabled={!enabled || pending} onClick={() => void send()}>
        {pending ? "Drafting" : "Send"}
      </Button>
    </div>
  )
}
