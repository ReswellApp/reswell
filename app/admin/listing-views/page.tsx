import { privatePageMetadata } from "@/lib/site-metadata"
import { AdminListingViewsClient } from "@/components/features/admin/admin-listing-views-client"

export const metadata = privatePageMetadata({
  title: "Listing views — Reswell admin",
  description:
    "Signed-in users’ listing detail views: who viewed which boards, how many times, and when.",
  path: "/admin/listing-views",
})

export default function AdminListingViewsPage() {
  return (
    <>
      <h1 className="sr-only">Listing views</h1>
      <AdminListingViewsClient />
    </>
  )
}
