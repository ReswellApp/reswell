import { permanentRedirect } from "next/navigation"
import { SearchPageView } from "./search-page-view"

interface SearchParams {
  q?: string
  section?: string
  view?: string
}

/** Search uses query params + auth; must not be statically prerendered. */
export const dynamic = "force-dynamic"

export default async function SearchPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const rawQuery = (searchParams.q ?? "").trim()
  const sectionParam = (searchParams.section ?? "all") as
    | "all"
    | "used"
    | "boards"

  if (!rawQuery) {
    const sp = new URLSearchParams()
    if (sectionParam !== "all") sp.set("section", sectionParam)
    permanentRedirect(`/search/recent${sp.size ? `?${sp}` : ""}`)
  }

  return (
    <SearchPageView
      rawQuery={rawQuery}
      sectionParam={sectionParam}
      showSeoBookmark={false}
    />
  )
}
