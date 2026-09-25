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
  const [flow, projects, catalog, messages] = await Promise.all([
    getEmailStudioFlowService(id),
    listEmailStudioService("project"),
    listKlaviyoFlowCatalogService(),
    listEmailStudioAssistantMessagesService("flow", id),
  ])
  if ("error" in flow) {
    if (flow.error === "Flow not found") notFound()
    return <p className="text-sm text-destructive">{flow.error}</p>
  }
  return (
    <EmailStudioFlowEditor
      flow={flow.data}
      projects={"success" in projects ? projects.data.map((project) => ({ id: project.id, name: project.name })) : []}
      metrics={catalog.metrics}
      lists={catalog.lists}
      segments={catalog.segments}
      klaviyoConnected={catalog.connected}
      assistantEnabled={isEmailStudioAssistantEnabled()}
      messages={"success" in messages ? messages.data ?? [] : []}
    />
  )
}
