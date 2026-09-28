"use client"

import { Check, Eye, GitBranch, LayoutTemplate, Sparkles, X } from "lucide-react"
import type { EmailStudioAssistantProposalPreview } from "@/lib/types/emailStudioCommands"
import { Button } from "@/components/ui/button"

export function EmailStudioAssistantProposal({
  proposal,
  pending,
  onAccept,
  onReject,
}: {
  proposal: EmailStudioAssistantProposalPreview
  pending: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const isEmail = proposal.scope === "email"
  const itemCount = isEmail
    ? proposal.email.document.blocks.length
    : proposal.flow.definition.steps.length

  return (
    <div className="overflow-hidden rounded-2xl border border-[#5574AD]/30 bg-background shadow-md">
      <div className="bg-gradient-to-br from-[#0F172A] to-[#355185] px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-xs font-semibold">Design ready to review</p>
            <p className="text-[10px] text-white/65">Previewing live on the canvas</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm leading-relaxed text-foreground">{proposal.summary}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-[#F8FAFC] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {isEmail ? <LayoutTemplate className="h-3 w-3" /> : <GitBranch className="h-3 w-3" />}
              {isEmail ? "Subject" : "Flow"}
            </div>
            <p className="truncate text-xs font-medium">
              {isEmail ? proposal.email.subject || "No subject" : proposal.flow.name}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-[#F8FAFC] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Eye className="h-3 w-3" />
              {isEmail ? "Layout" : "Graph"}
            </div>
            <p className="text-xs font-medium">
              {itemCount} {isEmail ? (itemCount === 1 ? "block" : "blocks") : (itemCount === 1 ? "action" : "actions")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-[#5574AD]/5 px-2.5 py-2">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#355185]" />
          <p className="text-[11px] leading-relaxed text-[#355185]">
            Look over the canvas. Accept applies this version; reject returns to your saved design.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" disabled={pending} onClick={onAccept}>
            <Check className="h-3.5 w-3.5" />
            Use this design
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={onReject}>
            <X className="h-3.5 w-3.5" />
            Discard
          </Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">
          {pending ? "Applying changes…" : "Nothing is saved until you accept"}
        </p>
      </div>
    </div>
  )
}
