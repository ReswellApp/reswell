import Link from "next/link"
import { privatePageMetadata } from "@/lib/site-metadata"
import { listEmailStudioFlowsService } from "@/lib/services/emailStudioFlows"
import { EmailStudioFlowLibrary } from "@/components/features/admin/email-studio/email-studio-flow-library"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Email flows — Admin — Reswell",
  description: "Build Klaviyo flows from the admin.",
  path: "/admin/email-studio/flows",
})

export default async function AdminEmailStudioFlowsPage() {
  const flows = await listEmailStudioFlowsService()
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground"><Link href="/admin/email-studio" className="hover:underline">Email studio</Link></p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Flows</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build a metric, list, segment, or profile-date trigger, then delays, emails, SMS, splits, profile updates, list updates, and webhooks. Push stores a draft in Klaviyo. It does not send until you set it live. Price-drop, A/B tests, push, and WhatsApp stay in Klaviyo.
        </p>
      </div>
      {"error" in flows ? <p className="text-sm text-destructive">{flows.error}</p> : <EmailStudioFlowLibrary flows={flows.data} />}
    </div>
  )
}
