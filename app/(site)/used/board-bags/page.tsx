import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { BoardBagsListingsFilters } from "@/components/board-bags-listings-filters"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import { normalizeBoardBagSizeParam } from "@/lib/board-bag-length-options"

const BOARD_BAGS_SLUG = "board-bags"

const BOARD_BAG_KIND_OPTIONS = ["day", "travel"] as const

function normalizeBoardBagParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return BOARD_BAG_KIND_OPTIONS.includes(v as (typeof BOARD_BAG_KIND_OPTIONS)[number]) ? v : "all"
}

export default async function UsedBoardBagsPage(props: {
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
    boardBag: normalizeBoardBagParam(searchParams.boardBag),
    size: normalizeBoardBagSizeParam(searchParams.size),
  }

  return (
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Board Bags</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved board bags — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <BoardBagsListingsFilters
              initialQ={searchParams.q ?? ""}
              initialBoardBag={normalizeBoardBagParam(searchParams.boardBag)}
              initialSize={normalizeBoardBagSizeParam(searchParams.size)}
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
                basePath="/used/board-bags"
                fixedCategorySlug={BOARD_BAGS_SLUG}
                clearFiltersHref="/used/board-bags"
                gearFilters
                applyBoardBagKindFilter
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
