import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchQualityAdminClient } from "@/components/features/admin/search-quality/search-quality-admin-client"

export const metadata = privatePageMetadata({
  title: "Search quality — Reswell admin",
  description:
    "Review marketplace search result sets, rate Good / Close / Bad, and train the NL helper from that memory.",
  path: "/admin/search-quality",
})

export default function AdminSearchQualityPage() {
  return (
    <>
      <h1 className="sr-only">Search quality</h1>
      <SearchQualityAdminClient />
    </>
  )
}
