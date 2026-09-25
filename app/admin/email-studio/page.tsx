import Link from "next/link"
import { privatePageMetadata } from "@/lib/site-metadata"
import { listEmailStudioService } from "@/lib/services/emailStudio"
import { EmailStudioLibrary } from "@/components/features/admin/email-studio/email-studio-library"

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
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Email studio</h1>
          <Link href="/admin/email-studio/flows" className="text-sm font-medium text-[#355185] hover:underline">Flows</Link>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build Reswell emails, then assemble them into a Klaviyo flow with delays, triggers, and splits. The assistant can draft both. Nothing sends until a flow is set live.
        </p>
      </div>
      {"error" in projects ? <p className="text-sm text-destructive">{projects.error}</p> : null}
      {"error" in templates ? <p className="text-sm text-destructive">{templates.error}</p> : null}
      <EmailStudioLibrary
        projects={"success" in projects ? projects.data : []}
        templates={"success" in templates ? templates.data : []}
      />
    </div>
  )
}
