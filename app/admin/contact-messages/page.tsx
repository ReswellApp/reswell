import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { CaseInboxAdminClient } from "@/components/features/admin/case-inbox-admin-client"
import { CaseInboxWorkspaceSkeleton } from "@/components/features/admin/case-inbox-workspace-skeleton"

export const metadata = privatePageMetadata({
  title: "Cases — Admin — Reswell",
  description: "Unified customer help cases — general, orders, and Purchase Protection claims.",
  path: "/admin/contact-messages",
})

export default function AdminContactMessagesPage() {
  return (
    <Suspense fallback={<CaseInboxWorkspaceSkeleton />}>
      <CaseInboxAdminClient />
    </Suspense>
  )
}
