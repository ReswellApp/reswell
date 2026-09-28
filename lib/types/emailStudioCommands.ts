import type { EmailBlock, EmailStudioDocument } from "@/lib/types/emailStudio"
import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowFilter,
  EmailStudioFlowStep,
  EmailStudioFlowTrigger,
} from "@/lib/types/emailStudioFlow"

export type EmailStudioScope = "email" | "flow"
export type EmailStudioChangeSource = "human" | "assistant" | "restore" | "system"
export type EmailStudioProposalStatus = "pending" | "applying" | "accepted" | "rejected" | "superseded"

export interface EmailStudioEmailSnapshot {
  name: string
  subject: string
  previewText: string
  flowName: string
  flowId: string
  triggerMetric: string
  notes: string
  document: EmailStudioDocument
}

export interface EmailStudioFlowSnapshot {
  name: string
  notes: string
  definition: EmailStudioFlowDefinition
}

export type EmailStudioEmailCommand =
  | {
      type: "email.meta.patch"
      patch: Partial<Omit<EmailStudioEmailSnapshot, "document">>
    }
  | { type: "email.document.replace"; document: EmailStudioDocument }
  | { type: "email.block.insert"; block: EmailBlock; index: number }
  | { type: "email.block.replace"; block: EmailBlock }
  | { type: "email.block.remove"; blockId: string }
  | { type: "email.block.move"; blockId: string; toIndex: number }

export type FlowLinkBranch = "next" | "yes" | "no"

export type EmailStudioFlowCommand =
  | { type: "flow.meta.patch"; patch: Partial<Omit<EmailStudioFlowSnapshot, "definition">> }
  | {
      type: "flow.email.create"
      projectId: string
      name: string
      subject: string
      previewText: string
      triggerMetric: string
      notes: string
      document: EmailStudioDocument
    }
  | { type: "flow.definition.replace"; definition: EmailStudioFlowDefinition }
  | { type: "flow.trigger.replace"; trigger: EmailStudioFlowTrigger }
  | { type: "flow.filter.replace"; filter: EmailStudioFlowFilter }
  | { type: "flow.entry.set"; stepId: string | null }
  | { type: "flow.step.insert"; step: EmailStudioFlowStep; index: number }
  | { type: "flow.step.replace"; step: EmailStudioFlowStep }
  | { type: "flow.step.remove"; stepId: string }
  | {
      type: "flow.link.set"
      fromId: string
      branch: FlowLinkBranch
      toId: string | null
    }

export type EmailStudioCommand = EmailStudioEmailCommand | EmailStudioFlowCommand

interface EmailStudioRevisionBase {
  id: string
  scopeId: string
  revision: number
  schemaVersion: number
  source: EmailStudioChangeSource
  summary: string
  commands: EmailStudioCommand[]
  createdBy: string | null
  createdAt: string
}

export type EmailStudioRevision =
  | (EmailStudioRevisionBase & { scope: "email"; snapshot: EmailStudioEmailSnapshot })
  | (EmailStudioRevisionBase & { scope: "flow"; snapshot: EmailStudioFlowSnapshot })

export interface EmailStudioProposal {
  id: string
  scope: EmailStudioScope
  scopeId: string
  baseRevision: number
  status: EmailStudioProposalStatus
  summary: string
  assistantMessage: string
  commands: EmailStudioCommand[]
  createdBy: string
  resolvedBy: string | null
  claimedAt: string | null
  acceptedRevision: number | null
  createdAt: string
  resolvedAt: string | null
}

export interface EmailStudioEmailProposalPreview {
  id: string
  baseRevision: number
  summary: string
  email: Pick<EmailStudioEmailSnapshot, "subject" | "previewText" | "notes" | "document">
}

export interface EmailStudioFlowProposalPreview {
  id: string
  baseRevision: number
  summary: string
  flow: EmailStudioFlowSnapshot
}

export type EmailStudioAssistantProposalPreview =
  | (EmailStudioEmailProposalPreview & { scope: "email" })
  | (EmailStudioFlowProposalPreview & { scope: "flow" })
