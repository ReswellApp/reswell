import { Suspense } from "react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { SaleFeedPanel } from "@/components/features/marketplace/sale-feed-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { getCachedSaleFeedPage } from "@/lib/cache/sale-feed"
import { parseSaleFeedPage, saleFeedHref } from "@/lib/sale-feed"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

/**
 * Backstop if a price change, publish, hide, or sale misses on-demand revalidation.
 * Those events expire this page immediately via `revalidateSaleFeedCatalog`.
 */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("sale")
}

async function SaleFeedData({ page }: { page: number }) {
  const { listings, totalCount, totalPages } = await getCachedSaleFeedPage(page)

  if (page > totalPages) {
    redirect(saleFeedHref(totalPages > 1 ? totalPages : undefined))
  }

  return (
    <SaleFeedPanel
      listings={listings}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  )
}

function SaleFeedFallback() {
  return (
    <>
      <Skeleton className="mb-6 h-[3.25rem] w-full max-w-xl mx-auto rounded-lg" />
      <ListingTileGridSkeleton count={10} ariaLabel="Loading sale listings" />
    </>
  )
}

export default async function SalePage(props: {
  searchParams: Promise<{ page?: string }>
}) {
  const page = parseSaleFeedPage((await props.searchParams).page)

  return (
    <main className="flex-1">
      <section className="border-b border-border bg-background">
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            On sale
          </h1>
          <p className="mt-1 text-muted-foreground">
            Active listings with a public markdown — a previous price shown above the current
            one, including price drops.
          </p>
        </div>
      </section>

      <section className="container mx-auto py-6">
        <Suspense fallback={<SaleFeedFallback />}>
          <SaleFeedData page={page} />
        </Suspense>
      </section>
    </main>
  )
}
