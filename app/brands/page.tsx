import type { Metadata } from "next"
import { Suspense } from "react"
import { BrandsDirectorySearch } from "@/components/brands/brands-directory-search"
import { BrandsCategoryFilter } from "@/components/brands/brands-category-filter"
import { BrandsExplorer } from "@/components/brands/brands-explorer"
import { BrandsListAdminBar } from "@/components/brands/brands-list-admin-bar"
import { createClient } from "@/lib/supabase/server"
import { listBrands } from "@/lib/brands/server"
import { sortDirectoryBrands, sumDirectoryListingCounts } from "@/lib/brands/directory-rank"
import {
  countActiveListingsByBrandIds,
  countPublicSoldListingsByBrandIds,
} from "@/lib/db/brand-listings"
import { parseBrandsDirectoryFilterCategorySlugsFromSearchParam } from "@/lib/brand-product-categories"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("brands")
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ brandRequest?: string; category?: string | string[] }>
}) {
  const sp = await searchParams
  const raw = sp.brandRequest
  const brandRequestImportId =
    typeof raw === "string" && UUID_RE.test(raw.trim()) ? raw.trim() : undefined
  const categoryFilter = parseBrandsDirectoryFilterCategorySlugsFromSearchParam(sp.category)

  const supabase = await createClient()
  const brands = await listBrands(supabase, {
    productCategories: categoryFilter.length > 0 ? categoryFilter : undefined,
  })
  const brandIds = brands.map((brand) => brand.id)
  const [activeListingCounts, soldListingCounts] = await Promise.all([
    countActiveListingsByBrandIds(supabase, brandIds),
    countPublicSoldListingsByBrandIds(supabase, brandIds),
  ])
  const rankedBrands = sortDirectoryBrands(
    brands,
    sumDirectoryListingCounts(activeListingCounts, soldListingCounts),
  )
  const activeListingCountByBrandId = Object.fromEntries(activeListingCounts)
  const soldListingCountByBrandId = Object.fromEntries(soldListingCounts)

  return (
    <main className="flex-1">
      <section className="border-b border-border/60 bg-[#E8EEF6]/70">
        <div className="container relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="absolute right-4 top-8 sm:right-6 sm:top-10">
            <BrandsListAdminBar brandRequestImportId={brandRequestImportId} brands={rankedBrands} />
          </div>
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              Popular brands on Reswell
            </h1>
            <p className="mt-3 text-pretty text-base text-muted-foreground sm:text-lg">
              Browse shapers and labels sorted by marketplace activity — then jump into models, live
              listings, and recently sold gear.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
            <div className="min-w-0 flex-1">
              <BrandsDirectorySearch brands={rankedBrands} />
            </div>
            <div className="lg:max-w-md lg:shrink-0">
              <Suspense fallback={null}>
                <BrandsCategoryFilter compact />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
      <BrandsExplorer
        brands={rankedBrands}
        categoryFilter={categoryFilter}
        activeListingCountByBrandId={activeListingCountByBrandId}
        soldListingCountByBrandId={soldListingCountByBrandId}
      />
    </main>
  )
}
