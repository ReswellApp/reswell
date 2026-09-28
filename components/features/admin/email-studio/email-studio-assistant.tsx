"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { resolveEmailStudioProposalAction } from "@/lib/actions/emailStudioCommands"
import { askEmailStudioAssistantAction } from "@/lib/actions/emailStudioFlows"
import type { EmailStudioDocument, EmailStudioRecord } from "@/lib/types/emailStudio"
import type {
  EmailStudioAssistantProposalPreview,
  EmailStudioFlowSnapshot,
} from "@/lib/types/emailStudioCommands"
import type {
  EmailStudioFlowRecord,
  EmailStudioMessage,
} from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"
import { EmailStudioAssistantProposal } from "@/components/features/admin/email-studio/email-studio-assistant-proposal"

const EMAIL_SUGGESTIONS = [
  "Redesign this email with a stronger visual hierarchy",
  "Make the selected block clearer and more concise",
  "Improve the subject and preview text",
]

const FLOW_SUGGESTIONS = [
  "Build a three-email lifecycle flow",
  "Add a delay and consent split",
  "Audit this flow for missing branches",
]

export function EmailStudioAssistant({
  scope,
  scopeId,
  enabled,
  initialMessages,
  initialProposal = null,
  snapshot,
  baseRevision,
  prepare,
  onEmailPreview,
  onEmailAccepted,
  onFlowPreview,
  onFlowAccepted,
}: {
  scope: "email" | "flow"
  scopeId: string
  enabled: boolean
  initialMessages: EmailStudioMessage[]
  initialProposal?: EmailStudioAssistantProposalPreview | null
  snapshot: string
  baseRevision: number
  prepare?: () => Promise<{
    snapshot: string
    baseRevision: number
    selectedBlockId?: string
  } | null>
  onEmailPreview?: (email: {
    subject: string
    previewText: string
    notes: string
    document: EmailStudioDocument
  } | null) => void
  onEmailAccepted?: (record: EmailStudioRecord) => void
  onFlowPreview?: (flow: EmailStudioFlowSnapshot | null) => void
  onFlowAccepted?: (record: EmailStudioFlowRecord) => void
}) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)
  const [proposal, setProposal] = useState<EmailStudioAssistantProposalPreview | null>(initialProposal)

  async function send() {
    const message = text.trim()
    if (!message || pending || proposal) return
    setPending(true)
    const context = prepare ? await prepare() : { snapshot, baseRevision }
    if (!context) {
      setPending(false)
      return
    }
    setText("")
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: message, createdAt: new Date().toISOString() },
    ])
    const result = await askEmailStudioAssistantAction({
      scope,
      scopeId,
      baseRevision: context.baseRevision,
      selectedBlockId: context.selectedBlockId,
      message,
      snapshot: context.snapshot,
    })
    setPending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "assistant", content: result.reply, createdAt: new Date().toISOString() },
    ])
    const proposedEmail = Boolean(result.email && result.proposalId && result.proposalScope === "email")
    const proposedFlow = Boolean(result.flow && result.proposalId && result.proposalScope === "flow")
    if (result.email && result.proposalId && result.proposalScope === "email") {
      const next = {
        scope: "email" as const,
        id: result.proposalId,
        baseRevision: result.baseRevision,
        summary: result.reply,
        email: result.email,
      }
      setProposal(next)
      onEmailPreview?.(result.email)
    }
    if (result.flow && result.proposalId && result.proposalScope === "flow") {
      const next = {
        scope: "flow" as const,
        id: result.proposalId,
        baseRevision: result.baseRevision,
        summary: result.reply,
        flow: result.flow,
      }
      setProposal(next)
      onFlowPreview?.(result.flow)
    }
    if (result.flowId && result.flowId !== scopeId && proposedEmail) {
      toast.success("Review the email proposal. The new flow is ready in Flows.")
    } else if (proposedEmail) {
      toast.success("Review the proposed changes on the canvas.")
    } else if (proposedFlow) {
      toast.success("Review the proposed flow on the canvas.")
    } else if (result.flowId && result.flowId !== scopeId) {
      toast.success("Flow draft is ready.")
      router.push(`/admin/email-studio/flows/${result.flowId}`)
    } else if (result.flowId) {
      toast.success("Flow updated.")
      router.refresh()
    }
  }

  async function resolve(decision: "accept" | "reject"): Promise<void> {
    if (!proposal || pending) return
    setPending(true)
    const result = await resolveEmailStudioProposalAction({
      proposalId: proposal.id,
      decision,
      expectedRevision: proposal.baseRevision,
    })
    setPending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    if (
      decision === "accept"
      && result.status === "accepted"
      && result.scope === "email"
      && "document" in result.data
    ) {
      onEmailAccepted?.(result.data)
      toast.success("Assistant changes saved")
    } else if (
      decision === "accept"
      && result.status === "accepted"
      && result.scope === "flow"
      && "definition" in result.data
    ) {
      onFlowAccepted?.(result.data)
      toast.success("Assistant flow saved")
    } else {
      toast.message("Proposal rejected")
    }
    setProposal(null)
    onEmailPreview?.(null)
    onFlowPreview?.(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assistant</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Describe the email or flow in plain language. Nothing sends until you approve and push it.
            </p>
            <div className="flex flex-wrap gap-1">
              {(scope === "email" ? EMAIL_SUGGESTIONS : FLOW_SUGGESTIONS).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-border px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted"
                  onClick={() => setText(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          <p key={message.id} className={`text-sm ${message.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
            {message.content}
          </p>
        ))}
        {proposal ? (
          <EmailStudioAssistantProposal
            proposal={proposal}
            pending={pending}
            onAccept={() => void resolve("accept")}
            onReject={() => void resolve("reject")}
          />
        ) : null}
      </div>
      <textarea
        value={text}
        aria-label="Message the assistant"
        placeholder={enabled ? "Describe the email or flow you want" : "Assistant is off until the AI gateway key is set"}
        disabled={!enabled || pending || Boolean(proposal)}
        className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void send()
          }
        }}
      />
      <Button size="sm" disabled={!enabled || pending || Boolean(proposal)} onClick={() => void send()}>
        {pending ? "Drafting" : "Send"}
      </Button>
    </div>
  )
}
