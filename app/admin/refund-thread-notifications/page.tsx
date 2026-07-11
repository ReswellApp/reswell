import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { RefundThreadNotificationsAdminClient } from "@/components/features/admin/refund-thread-notifications-admin-client"

export const metadata = privatePageMetadata({
  title: "Refund thread notifications — Admin — Reswell",
  description: "View refund and cancellation messages sent to sellers in marketplace threads.",
  path: "/admin/refund-thread-notifications",
})

export default function AdminRefundThreadNotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <RefundThreadNotificationsAdminClient />
    </Suspense>
  )
}
