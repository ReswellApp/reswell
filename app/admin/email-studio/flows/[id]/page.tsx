import { notFound } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { listEmailStudioService } from "@/lib/services/emailStudio"
import {
  getEmailStudioFlowService,
  listKlaviyoFlowCatalogService,
} from "@/lib/services/emailStudioFlows"
import {
  isEmailStudioAssistantEnabled,
  listEmailStudioAssistantMessagesService,
} from "@/lib/services/emailStudioAssistant"
import { getPendingEmailStudioProposalService } from "@/lib/services/emailStudioCommands"
import { EmailStudioFlowEditor } from "@/components/features/admin/email-studio/email-studio-flow-editor"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Edit flow — Admin — Reswell",
  description: "Edit a Klaviyo flow.",
  path: "/admin/email-studio/flows",
})

export default async function AdminEmailStudioFlowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [flow, projects, catalog, messages, proposal] = await Promise.all([
    getEmailStudioFlowService(id),
    listEmailStudioService("project"),
    listKlaviyoFlowCatalogService(),
    listEmailStudioAssistantMessagesService("flow", id),
    getPendingEmailStudioProposalService("flow", id),
  ])
  if ("error" in flow) {
    if (flow.error === "Flow not found") notFound()
    return <p className="text-sm text-destructive">{flow.error}</p>
  }
  const projectRecords = "success" in projects ? projects.data : []
  const linkedProjectsById = new Map(flow.linkedProjects.map((project) => [project.id, project]))
  const allProjectsById = new Map([
    ...projectRecords.map((project) => [project.id, project] as const),
    ...flow.linkedProjects.map((project) => [project.id, project] as const),
  ])
  const hasStaleLinkedEmails = flow.data.definition.steps.some((step) => {
    if (step.type !== "email") return false
    const project = linkedProjectsById.get(step.projectId)
    return !project || project.klaviyoSyncedRevision !== project.revision
  })
  return (
    <EmailStudioFlowEditor
      flow={flow.data}
      projects={[...allProjectsById.values()].map((project) => ({ id: project.id, name: project.name }))}
      hasStaleLinkedEmails={hasStaleLinkedEmails}
      metrics={catalog.metrics}
      lists={catalog.lists}
      segments={catalog.segments}
      klaviyoConnected={catalog.connected}
      assistantEnabled={isEmailStudioAssistantEnabled()}
      messages={"success" in messages ? messages.data ?? [] : []}
      pendingProposal={"success" in proposal && proposal.data?.scope === "flow" ? proposal.data : null}
    />
  )
}
