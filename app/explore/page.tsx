import { Suspense } from "react"
import { ExploreCatalog } from "@/components/features/explore/explore-catalog"
import { ExploreCatalogSkeleton } from "@/components/features/explore/explore-catalog-skeleton"
import { ExplorePageIntro } from "@/components/features/explore/explore-page-intro"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

/** Same cadence as the homepage catalog shell. */
export const revalidate = 3600

export async function generateMetadata() {
  return resolvePageMetadata("explore")
}

export default function ExplorePage() {
  return (
    <main className="flex-1">
      <ExplorePageIntro />
      <Suspense fallback={<ExploreCatalogSkeleton />}>
        <ExploreCatalog />
      </Suspense>
    </main>
  )
}
