import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ApparelLifestyleListingsFilters } from "@/components/apparel-lifestyle-listings-filters"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import { normalizeApparelKindParam, normalizeApparelSizeParam } from "@/lib/apparel-lifestyle-options"

const APPAREL_LIFESTYLE_SLUG = "apparel-lifestyle"

export default async function UsedApparelLifestylePage(props: {
  searchParams: Promise<UsedGearSearchParams>
}) {
  const searchParams = await props.searchParams

  const listingsSearchParams: UsedGearSearchParams = {
    q: searchParams.q,
    condition: searchParams.condition,
    sort: searchParams.sort,
    page: searchParams.page,
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
    apparel: normalizeApparelKindParam(searchParams.apparel),
    size: normalizeApparelSizeParam(searchParams.size),
  }

  return (
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Apparel &amp; Lifestyle</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved apparel and lifestyle gear — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto">
          <div className="container mx-auto min-w-0 flex justify-center">
            <ApparelLifestyleListingsFilters
              initialQ={searchParams.q ?? ""}
              initialApparel={normalizeApparelKindParam(searchParams.apparel)}
              initialSize={normalizeApparelSizeParam(searchParams.size)}
              initialCondition={searchParams.condition ?? "all"}
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
                basePath="/used/apparel-lifestyle"
                fixedCategorySlug={APPAREL_LIFESTYLE_SLUG}
                clearFiltersHref="/used/apparel-lifestyle"
                applyApparelKindFilter
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
