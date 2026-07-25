import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminHiddenListingsPanelLazy } from "@/components/features/admin/admin-hidden-listings-panel-lazy"

export const metadata = privatePageMetadata({
  title: "Hidden listings — Admin — Reswell",
  description:
    "Review listings hidden from the public site and restore visibility for active inventory blocking checkout.",
  path: "/admin/listings/hidden",
})

function HiddenListingsFallback() {
  return (
    <div className="flex items-center justify-center py-24" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground" />
    </div>
  )
}

export default function AdminHiddenListingsPage() {
  return (
    <Suspense fallback={<HiddenListingsFallback />}>
      <AdminHiddenListingsPanelLazy />
    </Suspense>
  )
}
