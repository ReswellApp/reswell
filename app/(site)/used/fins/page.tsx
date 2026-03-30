import { Suspense } from "react"
import type { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { FinsListingsFilters } from "@/components/fins-listings-filters"
import { ActiveFilterChips } from "@/components/active-filter-chips"
import { UsedGearListings, type UsedGearSearchParams } from "../used-gear-listings"
import { normalizeUsedGearSizeParam } from "@/lib/used-gear-filter-options"

const CONDITION_LABELS: Record<string, string> = {
  new: "New", like_new: "Like-New", good: "Good Condition", fair: "Fair Condition",
}

export async function generateMetadata(props: {
  searchParams: Promise<UsedGearSearchParams>
}): Promise<Metadata> {
  const sp = await props.searchParams
  const cond = sp.condition && sp.condition !== "all" ? CONDITION_LABELS[sp.condition] ?? "" : ""
  const brand = sp.brand && sp.brand !== "all" ? sp.brand : ""
  const titleParts = [cond, brand, "Fins"].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}surf fins${brand ? " by " + brand : ""} on Reswell. Find Futures, FCS, single fins and more.`
  return { title, description, openGraph: { title, description } }
}

const FINS_SLUG = "fins"

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

export default async function UsedFinsPage(props: { searchParams: Promise<UsedGearSearchParams> }) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: finsCat } = await supabase
    .from("categories")
    .select("id")
    .eq("section", "used")
    .eq("slug", FINS_SLUG)
    .maybeSingle()

  const brands = finsCat?.id ? await finsDistinctBrands(finsCat.id) : []

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
              clearHref="/used/fins"
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valuePrefixes={{ size: "Size " }}
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
                basePath="/used/fins"
                fixedCategorySlug={FINS_SLUG}
                clearFiltersHref="/used/fins"
                gearFilters
              />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
