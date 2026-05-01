import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminMarketplaceMessagesClient } from "@/components/features/admin/admin-marketplace-messages-client"

export const metadata = privatePageMetadata({
  title: "Marketplace messages — Admin — Reswell",
  description: "View buyer and seller direct messages across the marketplace.",
  path: "/admin/messages",
})

export default function AdminMarketplaceMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      }
    >
      <AdminMarketplaceMessagesClient />
    </Suspense>
  )
}
