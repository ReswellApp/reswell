import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { CaseInboxAdminClient } from "@/components/features/admin/case-inbox-admin-client"

export const metadata = privatePageMetadata({
  title: "Cases — Admin — Reswell",
  description: "Unified customer help cases — general, orders, and Purchase Protection claims.",
  path: "/admin/contact-messages",
})

export default function AdminContactMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <CaseInboxAdminClient />
    </Suspense>
  )
}
