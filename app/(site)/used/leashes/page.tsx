import { Suspense } from "react"
import type { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { LeashesListingsFilters } from "@/components/leashes-listings-filters"
import { ActiveFilterChips } from "@/components/active-filter-chips"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import { normalizeLeashLengthParam, normalizeLeashThicknessParam } from "@/lib/leash-options"

const LEASHES_SLUG = "leashes"

const CONDITION_LABELS: Record<string, string> = {
  new: "New", like_new: "Like-New", good: "Good Condition", fair: "Fair Condition",
}

export async function generateMetadata(props: {
  searchParams: Promise<UsedGearSearchParams>
}): Promise<Metadata> {
  const sp = await props.searchParams
  const cond = sp.condition && sp.condition !== "all" ? CONDITION_LABELS[sp.condition] ?? "" : ""
  const title = `${[cond, "Surf Leashes"].filter(Boolean).join(" ")} For Sale | Reswell`
  const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}surf leashes on Reswell. Find great deals from local surfers.`
  return { title, description, openGraph: { title, description } }
}

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
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Leashes</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved leashes — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <LeashesListingsFilters
              initialQ={searchParams.q ?? ""}
              initialLeashLength={normalizeLeashLengthParam(searchParams.leashLength)}
              initialLeashThickness={normalizeLeashThicknessParam(searchParams.leashThickness)}
              initialCondition={searchParams.condition ?? "all"}
            />
          </div>
        </section>

        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref="/used/leashes"
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valueSuffixes={{ leashLength: "ft", leashThickness: '" cord' }}
              valueLookups={{ condition: CONDITION_LABELS }}
            />
          </div>
        </Suspense>

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
                basePath="/used/leashes"
                fixedCategorySlug={LEASHES_SLUG}
                clearFiltersHref="/used/leashes"
                applyLeashFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
