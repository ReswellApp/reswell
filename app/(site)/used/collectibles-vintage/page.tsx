import { Suspense } from "react"
import type { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { CollectiblesListingsFilters } from "@/components/collectibles-listings-filters"
import { ActiveFilterChips } from "@/components/active-filter-chips"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import {
  COLLECTIBLE_TYPE_OPTIONS,
  COLLECTIBLE_ERA_OPTIONS,
  normalizeCollectibleTypeParam,
  normalizeCollectibleEraParam,
  normalizeCollectibleConditionParam,
} from "@/lib/collectible-options"

const COLLECTIBLES_SLUG = "collectibles-vintage"

export async function generateMetadata(props: {
  searchParams: Promise<UsedGearSearchParams>
}): Promise<Metadata> {
  const sp = await props.searchParams
  const typeLabel = sp.collectibleType && sp.collectibleType !== "all"
    ? COLLECTIBLE_TYPE_OPTIONS.find((o) => o.value === sp.collectibleType)?.label ?? ""
    : ""
  const eraLabel = sp.collectibleEra && sp.collectibleEra !== "all"
    ? COLLECTIBLE_ERA_OPTIONS.find((o) => o.value === sp.collectibleEra)?.label ?? ""
    : ""
  const title = `${[eraLabel, typeLabel, "Vintage Surf Collectibles"].filter(Boolean).join(" ")} | Reswell`
  const description = `Find rare vintage surf collectibles${typeLabel ? " — " + typeLabel : ""} on Reswell. Classic surf culture from ${eraLabel || "every era"}.`
  return { title, description, openGraph: { title, description } }
}

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
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Vintage</h1>
            <p className="text-center text-muted-foreground mt-2">
              Rare finds and classic surf culture — shipping only
            </p>
          </div>
        </section>

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <CollectiblesListingsFilters
              initialQ={searchParams.q ?? ""}
              initialCollectibleType={normalizeCollectibleTypeParam(searchParams.collectibleType)}
              initialCollectibleEra={normalizeCollectibleEraParam(searchParams.collectibleEra)}
              initialCollectibleCondition={normalizeCollectibleConditionParam(searchParams.collectibleCondition)}
            />
          </div>
        </section>

        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref="/used/collectibles-vintage"
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valueLookups={{
                collectibleType: Object.fromEntries(COLLECTIBLE_TYPE_OPTIONS.map((o) => [o.value, o.label])),
                collectibleEra: Object.fromEntries(COLLECTIBLE_ERA_OPTIONS.map((o) => [o.value, o.label])),
              }}
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
                basePath="/used/collectibles-vintage"
                fixedCategorySlug={COLLECTIBLES_SLUG}
                clearFiltersHref="/used/collectibles-vintage"
                applyCollectibleFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
