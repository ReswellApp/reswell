import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { FinsListingsFilters } from "@/components/fins-listings-filters"
import { ActiveFilterChips } from "@/components/active-filter-chips"
import { UsedGearListings, type UsedGearSearchParams } from "@/components/used-gear-listings"
import { normalizeUsedGearSizeParam } from "@/lib/used-gear-filter-options"
import { WetsuitsListingsFilters } from "@/components/wetsuits-listings-filters"
import {
  normalizeWetsuitSizeParam,
  normalizeWetsuitThicknessParam,
  normalizeWetsuitZipParam,
} from "@/lib/wetsuit-options"
import { LeashesListingsFilters } from "@/components/leashes-listings-filters"
import { normalizeLeashLengthParam, normalizeLeashThicknessParam } from "@/lib/leash-options"
import { BoardBagsListingsFilters } from "@/components/board-bags-listings-filters"
import { normalizeBoardBagSizeParam } from "@/lib/board-bag-length-options"
import { SurfpacksBagsListingsFilters } from "@/components/surfpacks-bags-listings-filters"
import {
  normalizeSurfpacksBagBrandParam,
  surfpacksBagsBrandOptions,
} from "@/lib/surfpacks-bags-brands"
import { ApparelLifestyleListingsFilters } from "@/components/apparel-lifestyle-listings-filters"
import {
  APPAREL_KIND_OPTIONS,
  normalizeApparelKindParam,
  normalizeApparelSizeParam,
} from "@/lib/apparel-lifestyle-options"
import { CollectiblesListingsFilters } from "@/components/collectibles-listings-filters"
import {
  COLLECTIBLE_TYPE_OPTIONS,
  COLLECTIBLE_ERA_OPTIONS,
  normalizeCollectibleTypeParam,
  normalizeCollectibleEraParam,
  normalizeCollectibleConditionParam,
} from "@/lib/collectible-options"
import { browsePresetForSlug } from "@/lib/used-category-browse-registry"
import { formatCategory, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"

const BOARD_BAG_KIND_OPTIONS = ["day", "travel"] as const

function normalizeBoardBagParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return BOARD_BAG_KIND_OPTIONS.includes(v as (typeof BOARD_BAG_KIND_OPTIONS)[number]) ? v : "all"
}

const PACK_OPTIONS = ["surfpack", "bag"] as const

function normalizePackParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return PACK_OPTIONS.includes(v as (typeof PACK_OPTIONS)[number]) ? v : "all"
}

function normalizeFacetParam(value: string | undefined, options: string[]): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return options.includes(v) ? v : "all"
}

async function finsDistinctBrands(categoryId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("brand")
    .eq("section", "used")
    .eq("status", "active")
    .eq("category_id", categoryId)

  const brands = new Set<string>()
  for (const row of data ?? []) {
    if (row.brand?.trim()) brands.add(row.brand.trim())
  }
  return [...brands].sort((a, b) => a.localeCompare(b))
}

async function backpackDistinctBrands(categoryId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("brand")
    .eq("section", "used")
    .eq("status", "active")
    .eq("category_id", categoryId)

  const brands = new Set<string>()
  for (const row of data ?? []) {
    if (row.brand?.trim()) brands.add(row.brand.trim())
  }
  return [...brands]
}

function gridSkeleton() {
  return (
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
  )
}

export async function UsedCategoryBrowsePage(props: {
  category: { id: string; name: string; slug: string }
  searchParams: Promise<UsedGearSearchParams>
}) {
  const { category } = props
  const searchParams = await props.searchParams
  const basePath = `/${category.slug}`
  const preset = browsePresetForSlug(category.slug)

  if (preset === "fins") {
    const brands = await finsDistinctBrands(category.id)
    const listingsSearchParams: UsedGearSearchParams = {
      q: searchParams.q,
      condition: searchParams.condition,
      sort: searchParams.sort,
      page: searchParams.page,
      minPrice: searchParams.minPrice,
      maxPrice: searchParams.maxPrice,
      brand: normalizeFacetParam(searchParams.brand, brands),
      size: normalizeUsedGearSizeParam(searchParams.size),
    }
    return (
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Fins</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved Fins — shipping only
            </p>
          </div>
        </section>
        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <FinsListingsFilters
              brandOptions={brands}
              initialQ={searchParams.q ?? ""}
              initialBrand={normalizeFacetParam(searchParams.brand, brands)}
              initialSize={normalizeUsedGearSizeParam(searchParams.size)}
              initialCondition={searchParams.condition ?? "all"}
            />
          </div>
        </section>
        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref={basePath}
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valuePrefixes={{ size: "Size " }}
              valueLookups={{ condition: LISTING_CONDITION_LABELS }}
            />
          </div>
        </Suspense>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                gearFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  if (preset === "wetsuits") {
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
        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref={basePath}
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valuePrefixes={{ size: "Size " }}
              valueLookups={{ condition: LISTING_CONDITION_LABELS }}
            />
          </div>
        </Suspense>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                applyWetsuitFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  if (preset === "leashes") {
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
              clearHref={basePath}
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valueSuffixes={{ leashLength: "ft", leashThickness: '" cord' }}
              valueLookups={{ condition: LISTING_CONDITION_LABELS }}
            />
          </div>
        </Suspense>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                applyLeashFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  if (preset === "board-bags") {
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
        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref={basePath}
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valueLookups={{
                boardBag: { day: "Day Bags", travel: "Travel Bags" },
                condition: LISTING_CONDITION_LABELS,
              }}
            />
          </div>
        </Suspense>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                gearFilters
                applyBoardBagKindFilter
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  if (preset === "backpacks") {
    const dynamicBrands = await backpackDistinctBrands(category.id)
    const brandOptions = surfpacksBagsBrandOptions(dynamicBrands)
    const normalizedBrand = normalizeSurfpacksBagBrandParam(searchParams.brand, brandOptions)
    const listingsSearchParams: UsedGearSearchParams = {
      q: searchParams.q,
      condition: searchParams.condition,
      sort: searchParams.sort,
      page: searchParams.page,
      minPrice: searchParams.minPrice,
      maxPrice: searchParams.maxPrice,
      pack: normalizePackParam(searchParams.pack),
      brand: normalizedBrand,
    }
    return (
      <main className="flex-1">
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Surfpacks &amp; Bags</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved surfpacks and bags — shipping only
            </p>
          </div>
        </section>
        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <SurfpacksBagsListingsFilters
              brandOptions={brandOptions}
              initialQ={searchParams.q ?? ""}
              initialPack={normalizePackParam(searchParams.pack)}
              initialBrand={normalizedBrand}
              initialCondition={searchParams.condition ?? "all"}
            />
          </div>
        </section>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                gearFilters
                applyPackKindFilter
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  if (preset === "apparel-lifestyle") {
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
        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <ApparelLifestyleListingsFilters
              initialQ={searchParams.q ?? ""}
              initialApparel={normalizeApparelKindParam(searchParams.apparel)}
              initialSize={normalizeApparelSizeParam(searchParams.size)}
              initialCondition={searchParams.condition ?? "all"}
            />
          </div>
        </section>
        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref={basePath}
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valuePrefixes={{ size: "Size " }}
              valueLookups={{
                apparel: Object.fromEntries(APPAREL_KIND_OPTIONS.map((o) => [o.value, o.label])),
                condition: LISTING_CONDITION_LABELS,
              }}
            />
          </div>
        </Suspense>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                applyApparelKindFilter
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  if (preset === "collectibles-vintage") {
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
              initialCollectibleCondition={normalizeCollectibleConditionParam(
                searchParams.collectibleCondition,
              )}
            />
          </div>
        </section>
        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref={basePath}
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valueLookups={{
                collectibleType: Object.fromEntries(
                  COLLECTIBLE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
                ),
                collectibleEra: Object.fromEntries(
                  COLLECTIBLE_ERA_OPTIONS.map((o) => [o.value, o.label]),
                ),
              }}
            />
          </div>
        </Suspense>
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense fallback={gridSkeleton()}>
              <UsedGearListings
                searchParams={listingsSearchParams}
                basePath={basePath}
                fixedCategorySlug={category.slug}
                clearFiltersHref={basePath}
                applyCollectibleFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
    )
  }

  const listingsSearchParams: UsedGearSearchParams = {
    q: searchParams.q,
    condition: searchParams.condition,
    sort: searchParams.sort,
    page: searchParams.page,
    minPrice: searchParams.minPrice,
    maxPrice: searchParams.maxPrice,
  }
  const label = formatCategory(category.name)
  return (
    <main className="flex-1">
      <section className="bg-offwhite py-12">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-center">{label}</h1>
          <p className="text-center text-muted-foreground mt-2">
            Find great deals on pre-loved {label.toLowerCase()} — shipping only
          </p>
        </div>
      </section>
      <section className="py-8">
        <div className="container mx-auto">
          <Suspense fallback={gridSkeleton()}>
            <UsedGearListings
              searchParams={listingsSearchParams}
              basePath={basePath}
              fixedCategorySlug={category.slug}
              clearFiltersHref={basePath}
            />
          </Suspense>
        </div>
      </section>
    </main>
  )
}
