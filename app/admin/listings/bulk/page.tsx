import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminBulkListingClient } from "@/components/features/admin/admin-bulk-listing-client"
import { Loader2 } from "lucide-react"

export const metadata = privatePageMetadata({
  title: "Bulk list listings — Admin — Reswell",
  description: "Create up to 25 marketplace listings in one admin session.",
  path: "/admin/listings/bulk",
})

function BulkListingFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
    </div>
  )
}

export default function AdminBulkListingsPage() {
  return (
    <Suspense fallback={<BulkListingFallback />}>
      <AdminBulkListingClient />
    </Suspense>
  )
}
