import { Suspense } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { CollectiblesListingsFilters } from "@/components/collectibles-listings-filters"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import {
  normalizeCollectibleTypeParam,
  normalizeCollectibleEraParam,
  normalizeCollectibleConditionParam,
} from "@/lib/collectible-options"

const COLLECTIBLES_SLUG = "collectibles-vintage"

export default async function UsedCollectiblesVintagePage(props: {
  searchParams: Promise<UsedGearSearchParams>
}) {
  const searchParams = await props.searchParams

  const listingsSearchParams: UsedGearSearchParams = {
    q: searchParams.q,
    sort: searchParams.sort,
    page: searchParams.page,
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
    collectibleType: normalizeCollectibleTypeParam(searchParams.collectibleType),
    collectibleEra: normalizeCollectibleEraParam(searchParams.collectibleEra),
    collectibleCondition: normalizeCollectibleConditionParam(searchParams.collectibleCondition),
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Collectibles & Vintage</h1>
            <p className="text-center text-muted-foreground mt-2">
              Rare finds and classic surf culture — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto">
          <div className="container mx-auto min-w-0 flex justify-center">
            <CollectiblesListingsFilters
              initialQ={searchParams.q ?? ""}
              initialCollectibleType={normalizeCollectibleTypeParam(searchParams.collectibleType)}
              initialCollectibleEra={normalizeCollectibleEraParam(searchParams.collectibleEra)}
              initialCollectibleCondition={normalizeCollectibleConditionParam(searchParams.collectibleCondition)}
              initialSort={searchParams.sort ?? "newest"}
            />
          </div>
        </section>

        <section className="py-8">
          <div className="container mx-auto">
            <Suspense
              fallback={
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-[4/5] bg-muted animate-pulse" />
                      <CardContent className="p-4 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath="/used/collectibles-vintage"
                fixedCategorySlug={COLLECTIBLES_SLUG}
                clearFiltersHref="/used/collectibles-vintage"
                applyCollectibleFilters
              />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
