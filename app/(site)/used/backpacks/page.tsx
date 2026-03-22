import { Suspense } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { SurfpacksBagsListingsFilters } from "@/components/surfpacks-bags-listings-filters"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import {
  normalizeSurfpacksBagBrandParam,
  surfpacksBagsBrandOptions,
} from "@/lib/surfpacks-bags-brands"

const BACKPACKS_SLUG = "backpacks"

const PACK_OPTIONS = ["surfpack", "bag"] as const

function normalizePackParam(value: string | undefined): string {
  const v = value?.trim()
  if (!v || v === "all") return "all"
  return PACK_OPTIONS.includes(v as (typeof PACK_OPTIONS)[number]) ? v : "all"
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

export default async function UsedSurfpacksBagsPage(props: {
  searchParams: Promise<UsedGearSearchParams>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: backpackCat } = await supabase
    .from("categories")
    .select("id")
    .eq("section", "used")
    .eq("slug", BACKPACKS_SLUG)
    .maybeSingle()

  const dynamicBrands = backpackCat?.id ? await backpackDistinctBrands(backpackCat.id) : []
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

        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto">
          <div className="container mx-auto min-w-0 flex justify-center">
            <SurfpacksBagsListingsFilters
              brandOptions={brandOptions}
              initialQ={searchParams.q ?? ""}
              initialPack={normalizePackParam(searchParams.pack)}
              initialBrand={normalizedBrand}
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
                basePath="/used/backpacks"
                fixedCategorySlug={BACKPACKS_SLUG}
                clearFiltersHref="/used/backpacks"
                gearFilters
                applyPackKindFilter
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
