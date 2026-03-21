import { Suspense } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import { LeashesListingsFilters } from "@/components/leashes-listings-filters"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import { normalizeLeashLengthParam, normalizeLeashThicknessParam } from "@/lib/leash-options"

const LEASHES_SLUG = "leashes"

export default async function UsedLeashesPage(props: {
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
    leashLength: normalizeLeashLengthParam(searchParams.leashLength),
    leashThickness: normalizeLeashThicknessParam(searchParams.leashThickness),
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Leashes</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved leashes — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto">
          <div className="container mx-auto min-w-0 flex justify-center">
            <LeashesListingsFilters
              initialQ={searchParams.q ?? ""}
              initialLeashLength={normalizeLeashLengthParam(searchParams.leashLength)}
              initialLeashThickness={normalizeLeashThicknessParam(searchParams.leashThickness)}
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
                      <div className="aspect-square bg-muted animate-pulse" />
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
                basePath="/used/leashes"
                fixedCategorySlug={LEASHES_SLUG}
                clearFiltersHref="/used/leashes"
                applyLeashFilters
              />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
