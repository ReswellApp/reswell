import { privatePageMetadata } from "@/lib/site-metadata"
import { listEmailStudioService } from "@/lib/services/emailStudio"
import { isEmailStudioAssistantEnabled } from "@/lib/services/emailStudioAssistant"
import { EmailStudioWorkspace } from "@/components/features/admin/email-studio/email-studio-workspace"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Email studio — Admin — Reswell",
  description: "Build Klaviyo email templates and download the HTML.",
  path: "/admin/email-studio",
})

export default async function AdminEmailStudioPage() {
  const [projects, templates] = await Promise.all([
    listEmailStudioService("project"),
    listEmailStudioService("template"),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Email studio</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Design, test, and publish on-brand email templates for Klaviyo.
        </p>
      </div>
      {"error" in projects ? <p className="text-sm text-destructive">{projects.error}</p> : null}
      {"error" in templates ? <p className="text-sm text-destructive">{templates.error}</p> : null}
      <EmailStudioWorkspace
        projects={"success" in projects ? projects.data : []}
        templates={"success" in templates ? templates.data : []}
        assistantEnabled={isEmailStudioAssistantEnabled()}
      />
    </div>
  )
}
