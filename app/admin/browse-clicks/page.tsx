import { privatePageMetadata } from "@/lib/site-metadata"
import { BrowseClicksAdminClient } from "@/components/features/admin/browse-clicks-admin-client"

export const metadata = privatePageMetadata({
  title: "Browse clicks — Reswell admin",
  description:
    "Ship to me and category Filter button click counts across marketplace browse pages.",
  path: "/admin/browse-clicks",
})

export default function AdminBrowseClicksPage() {
  return (
    <>
      <h1 className="sr-only">Browse button click analytics</h1>
      <BrowseClicksAdminClient />
    </>
  )
}
