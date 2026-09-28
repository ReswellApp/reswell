"use client"

import { Check, X } from "lucide-react"
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
  return (
    <div className="space-y-3 rounded-lg border border-[#5574AD]/40 bg-[#5574AD]/5 p-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#355185]">Proposed changes</p>
        <p className="mt-1 text-sm">{proposal.summary}</p>
      </div>
      <dl className="space-y-1 text-xs">
        <div className="grid grid-cols-[64px_1fr] gap-2">
          <dt className="text-muted-foreground">{proposal.scope === "email" ? "Subject" : "Flow"}</dt>
          <dd className="truncate">
            {proposal.scope === "email"
              ? proposal.email.subject || "No subject"
              : proposal.flow.name}
          </dd>
        </div>
        <div className="grid grid-cols-[64px_1fr] gap-2">
          <dt className="text-muted-foreground">{proposal.scope === "email" ? "Layout" : "Graph"}</dt>
          <dd>
            {proposal.scope === "email"
              ? `${proposal.email.document.blocks.length} blocks`
              : `${proposal.flow.definition.steps.length} actions`}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Previewing on the canvas. Nothing is saved until you accept.
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={onAccept}>
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Accept
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={onReject}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  )
}
