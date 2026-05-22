import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { CrmAdminClient } from "@/components/features/admin/crm/crm-admin-client"

export const metadata = privatePageMetadata({
  title: "CRM — Admin — Reswell",
  description: "Track surfboard shoppers, board interests, and customer touchpoints.",
  path: "/admin/crm",
})

export default function AdminCrmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading CRM…</p>
        </div>
      }
    >
      <CrmAdminClient />
    </Suspense>
  )
}
