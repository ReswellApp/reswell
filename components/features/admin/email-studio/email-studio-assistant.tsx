"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  Check,
  Command,
  LayoutTemplate,
  MessageSquareText,
  Sparkles,
  WandSparkles,
} from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { EmailStudioAssistantProposal } from "@/components/features/admin/email-studio/email-studio-assistant-proposal"

const EMAIL_SUGGESTIONS = [
  {
    label: "Redesign the layout",
    prompt: "Redesign this as a dark hero, a three-up section, and a closer",
  },
  {
    label: "Sharpen the copy",
    prompt: "Rewrite the selected block so it is shorter and more specific",
  },
  {
    label: "Build a complete email",
    prompt: "Write a subject and preview, then rebuild the layout",
  },
]

const FLOW_SUGGESTIONS = [
  {
    label: "Welcome sequence",
    prompt: "Design a three-email welcome flow with a one-day delay",
  },
  {
    label: "Consent split",
    prompt: "Add a consent split, then a transactional email and a product email",
  },
  {
    label: "Redesign every send",
    prompt: "Rebuild this flow so every email has its own layout",
  },
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, pending, proposal])

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

  const suggestions = scope === "email" ? EMAIL_SUGGESTIONS : FLOW_SUGGESTIONS
  const canSend = enabled && !pending && !proposal && text.trim().length > 0

  return (
    <div className="-m-3 flex h-[calc(100%+1.5rem)] min-h-0 flex-col bg-[#F8FAFC]">
      <header className="border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Reswell design assistant</h2>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  enabled ? "bg-emerald-500" : "bg-amber-500",
                )}
                aria-hidden="true"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {scope === "email" ? "Designing this email" : "Building this Klaviyo flow"}
            </p>
          </div>
          {proposal ? (
            <span className="rounded-full bg-[#5574AD]/10 px-2 py-1 text-[10px] font-medium text-[#355185]">
              Preview ready
            </span>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#5574AD]/15 bg-gradient-to-br from-white to-[#EEF3FB] p-4 shadow-sm">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#5574AD]/10 text-[#355185]">
                <WandSparkles className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">
                {scope === "email" ? "What should this email become?" : "What should this flow do?"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Describe the goal, tone, and layout. I will build a preview on the
                {scope === "email" ? " artboard" : " flow canvas"} before anything is saved.
              </p>
            </div>
            <div className="space-y-2">
              <p className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Try a prompt
              </p>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.label}
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-px hover:border-[#5574AD]/40 hover:shadow-md"
                  onClick={() => setText(suggestion.prompt)}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground group-hover:bg-[#5574AD]/10 group-hover:text-[#355185]">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{suggestion.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {suggestion.prompt}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex gap-2.5", message.role === "user" && "justify-end")}
          >
            {message.role === "assistant" ? (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed shadow-sm",
                message.role === "user"
                  ? "rounded-br-md bg-[#5574AD] text-white"
                  : "rounded-bl-md border border-border bg-background text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {pending && !proposal ? (
          <div className="flex gap-2.5" aria-live="polite">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-background px-3 py-2.5 shadow-sm">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5574AD]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5574AD] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5574AD] [animation-delay:300ms]" />
              </span>
              <span className="text-xs text-muted-foreground">
                {scope === "email" ? "Designing on the artboard…" : "Building the flow…"}
              </span>
            </div>
          </div>
        ) : null}
        {proposal ? (
          <EmailStudioAssistantProposal
            proposal={proposal}
            pending={pending}
            onAccept={() => void resolve("accept")}
            onReject={() => void resolve("reject")}
          />
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <footer className="border-t border-border bg-background p-3">
        {proposal ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#5574AD]/5 px-2.5 py-2 text-[11px] text-[#355185]">
            <Check className="h-3.5 w-3.5" />
            Review the preview before starting another request.
          </div>
        ) : null}
        <div className="rounded-2xl border border-border bg-background p-2 shadow-sm transition focus-within:border-[#5574AD]/50 focus-within:ring-2 focus-within:ring-[#5574AD]/10">
          <Textarea
            value={text}
            aria-label="Message the assistant"
            placeholder={
              enabled
                ? scope === "email"
                  ? "Describe a layout, rewrite, or campaign…"
                  : "Describe a flow, trigger, or sequence…"
                : "Assistant is off until the AI gateway key is set"
            }
            maxLength={4000}
            disabled={!enabled || pending || Boolean(proposal)}
            className="min-h-20 resize-none border-0 p-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (canSend) void send()
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Command className="h-3 w-3" />
              Enter to send · Shift + Enter for a new line
            </span>
            <Button
              size="icon"
              className="h-8 w-8 rounded-xl"
              aria-label="Send message"
              disabled={!canSend}
              onClick={() => void send()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <LayoutTemplate className="h-3 w-3" />
            Canvas-aware
          </span>
          <span className="flex items-center gap-1">
            <MessageSquareText className="h-3 w-3" />
            Approval required
          </span>
        </div>
      </footer>
    </div>
  )
}
