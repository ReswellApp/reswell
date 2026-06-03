import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchCurationAdminClient } from "@/components/features/admin/search-curation/search-curation-admin-client"

export const metadata = privatePageMetadata({
  title: "Search curation — Reswell admin",
  description:
    "Fix zero-result searches: add synonyms for misspellings/aliases and pin listings for queries that return nothing.",
  path: "/admin/search-curation",
})

export default function AdminSearchCurationPage() {
  return (
    <>
      <h1 className="sr-only">Search curation</h1>
      <SearchCurationAdminClient />
    </>
  )
}
