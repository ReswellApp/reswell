import { notFound } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { getEmailStudioService, listEmailStudioFlowsService } from "@/lib/services/emailStudio"
import { EmailStudioEditor } from "@/components/features/admin/email-studio/email-studio-editor"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Edit email — Admin — Reswell",
  description: "Edit a Klaviyo email template.",
  path: "/admin/email-studio",
})

export default async function AdminEmailStudioEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [project, flows] = await Promise.all([
    getEmailStudioService(id),
    listEmailStudioFlowsService(),
  ])
  if ("error" in project) {
    if (project.error === "Project not found") notFound()
    return <p className="text-sm text-destructive">{project.error}</p>
  }

  return (
    <EmailStudioEditor
      project={project.data}
      flows={flows.flows}
      klaviyoConnected={flows.connected}
    />
  )
}
