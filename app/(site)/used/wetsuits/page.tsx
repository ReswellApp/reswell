import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { WetsuitsListingsFilters } from "@/components/wetsuits-listings-filters"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import {
  normalizeWetsuitSizeParam,
  normalizeWetsuitThicknessParam,
  normalizeWetsuitZipParam,
} from "@/lib/wetsuit-options"

const WETSUITS_SLUG = "wetsuits"

export default async function UsedWetsuitsPage(props: {
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
    size: normalizeWetsuitSizeParam(searchParams.size),
    thickness: normalizeWetsuitThicknessParam(searchParams.thickness),
    zipType: normalizeWetsuitZipParam(searchParams.zipType),
  }

  return (
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Wetsuits</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved wetsuits — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <WetsuitsListingsFilters
              initialQ={searchParams.q ?? ""}
              initialSize={normalizeWetsuitSizeParam(searchParams.size)}
              initialThickness={normalizeWetsuitThicknessParam(searchParams.thickness)}
              initialZipType={normalizeWetsuitZipParam(searchParams.zipType)}
              initialCondition={searchParams.condition ?? "all"}
            />
          </div>
        </section>

        <section className="py-8">
          <div className="container mx-auto">
            <Suspense
              fallback={
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-[3/4] w-full bg-muted animate-pulse" />
                      <CardContent className="p-3 space-y-2">
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
                basePath="/used/wetsuits"
                fixedCategorySlug={WETSUITS_SLUG}
                clearFiltersHref="/used/wetsuits"
                applyWetsuitFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
