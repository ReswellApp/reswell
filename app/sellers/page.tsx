import { Suspense } from "react"
import { SellersBreadcrumbs } from "@/components/sellers/sellers-breadcrumbs"
import { SellersDirectoryAdminBar } from "@/components/sellers/sellers-directory-admin-bar"
import {
  SellersDirectoryQueryProvider,
  SellersDirectorySearchField,
} from "@/components/sellers/sellers-directory-query"
import { SellersDirectoryFilteredResults } from "@/components/sellers/sellers-directory-results"
import {
  SellersDirectoryGuestSellCta,
  SellersDirectoryViewerProvider,
} from "@/components/sellers/sellers-directory-viewer"
import { SellersDirectoryGridSkeleton } from "@/components/sellers/sellers-page-skeleton"
import { getCachedSellersDirectoryCatalog } from "@/lib/cache/sellers-directory-catalog"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

/**
 * ISR: one document for every visitor. Search filters the cached catalog in the
 * browser. Follow state hydrates after mount. The header renders immediately;
 * only the grid waits on the catalog. Must be a static literal
 * (see SELLERS_DIRECTORY_REVALIDATE_SECONDS).
 */
export const revalidate = 604800

export async function generateMetadata() {
  return resolvePageMetadata("sellers")
}

async function SellersDirectoryCatalogSection() {
  const catalog = await getCachedSellersDirectoryCatalog()

  return (
    <SellersDirectoryViewerProvider sellerIds={catalog.items.map((item) => item.shop.id)}>
      <SellersDirectoryFilteredResults
        items={catalog.items}
        totalInventory={catalog.totalInventory}
      />
      <SellersDirectoryGuestSellCta />
    </SellersDirectoryViewerProvider>
  )
}

export default function SellersPage() {
  return (
    <SellersDirectoryQueryProvider>
      <main className="flex-1">
        <section className="border-b border-border/60 bg-offwhite py-10 sm:py-12">
          <div className="container relative mx-auto px-4 sm:px-6">
            <div className="absolute right-2 top-0 z-10 sm:right-4">
              <SellersDirectoryAdminBar />
            </div>
            <SellersBreadcrumbs className="mb-6 min-w-0 max-w-full sm:mb-8" />
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
                Explore sellers on Reswell
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground text-pretty sm:text-base">
                Every purchase you make on Reswell supports another surfer just like you. Browse profiles below to find
                sellers near you or who offer shipping to your area.
              </p>
              <SellersDirectorySearchField className="mx-auto mt-7 max-w-lg" />
            </div>
          </div>
        </section>

        <Suspense fallback={<SellersDirectoryGridSkeleton />}>
          <SellersDirectoryCatalogSection />
        </Suspense>
      </main>
    </SellersDirectoryQueryProvider>
  )
}
