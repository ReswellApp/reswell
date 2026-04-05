import { Suspense } from "react"
import type { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { formatCategory } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { UsedListingsFilters } from "@/components/used-listings-filters"
import { ActiveFilterChips } from "@/components/active-filter-chips"
import { UsedGearListings, type UsedGearSearchParams } from "./used-gear-listings"

const CONDITION_LABELS: Record<string, string> = {
  new: "New", like_new: "Like-New", good: "Good Condition", fair: "Fair Condition",
}

export async function generateMetadata(props: {
  searchParams: Promise<UsedGearSearchParams>
}): Promise<Metadata> {
  const sp = await props.searchParams
  const cond = sp.condition && sp.condition !== "all" ? CONDITION_LABELS[sp.condition] ?? "" : ""
  const title = `${[cond, "Used Surf Gear"].filter(Boolean).join(" ")} For Sale | Reswell`
  const description = `Shop ${cond ? cond.toLowerCase() + " " : ""}used surf gear on Reswell — fins, wetsuits, leashes, apparel and more.`
  return { title, description, openGraph: { title, description } }
}

export default async function UsedGearPage(props: {
  searchParams: Promise<UsedGearSearchParams>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: usedCategories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("section", "used")
    .order("name")

  // Exclude categories we do not surface in the All Gear UI
  const excludedSlugs = [
    "hardware-accessories",
    "travel-storage",
    "traction-pads-used",
    "collectibles-vintage",
  ]
  const filtered = usedCategories?.filter((c) => !excludedSlugs.includes(c.slug)) ?? []
  const slugsAtBottom = ["apparel-lifestyle", "collectibles-vintage"]
  const sorted = filtered.slice().sort((a, b) => {
    const aAtBottom = slugsAtBottom.indexOf(a.slug)
    const bAtBottom = slugsAtBottom.indexOf(b.slug)
    if (aAtBottom === -1 && bAtBottom === -1) return 0
    if (aAtBottom === -1) return -1
    if (bAtBottom === -1) return 1
    return aAtBottom - bAtBottom
  })

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...sorted.map((c) => ({ value: c.slug, label: c.name })),
  ]

  const rawCategory = searchParams.category?.trim()
  const categoryInMenu =
    !rawCategory ||
    rawCategory === "all" ||
    sorted.some((c) => c.slug === rawCategory)
  const initialCategory = categoryInMenu ? (rawCategory || "all") : "all"
  const listingSearchParams: UsedGearSearchParams = categoryInMenu
    ? searchParams
    : { ...searchParams, category: undefined }

  const selectedSlug =
    rawCategory &&
    rawCategory !== "all" &&
    sorted.some((c) => c.slug === rawCategory)
      ? rawCategory
      : null
  const selectedCategory = selectedSlug
    ? sorted.find((c) => c.slug === selectedSlug)
    : undefined
  const pageTitle = selectedCategory
    ? formatCategory(selectedCategory.name)
    : "All Gear"
  const pageSubtitle = selectedCategory
    ? `Find great deals on pre-loved ${formatCategory(selectedCategory.name)} — shipping only`
    : "Find great deals on pre-loved surf accessories — shipping only"

  return (
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">{pageTitle}</h1>
            <p className="text-center text-muted-foreground mt-2">
              {pageSubtitle}
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="border-b py-4 sticky top-14 sm:top-16 bg-background z-40 min-w-0 overflow-x-auto overflow-y-hidden">
          <div className="container mx-auto min-w-0 flex justify-center">
            <UsedListingsFilters
              categoryOptions={categoryOptions}
              initialQ={searchParams.q ?? ""}
              initialCategory={initialCategory}
              initialCondition={searchParams.condition ?? "all"}
            />
          </div>
        </section>

        <Suspense fallback={null}>
          <div className="container mx-auto px-4 pt-3 pb-1">
            <ActiveFilterChips
              clearHref="/used"
              ignore={["page", "minPrice", "maxPrice"]}
              quoteValues={["q"]}
              valueLookups={{ condition: CONDITION_LABELS }}
            />
          </div>
        </Suspense>

        {/* Listings */}
        <section className="py-8">
          <div className="container mx-auto">
            <Suspense
              fallback={
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-[3/4] w-full skeleton" />
                      <CardContent className="p-3 space-y-2">
                        <div className="h-3.5 skeleton" style={{ width: `${60 + (i % 3) * 15}%` }} />
                        <div className="h-3 skeleton" style={{ width: `${40 + (i % 4) * 10}%` }} />
                        <div className="h-5 w-16 skeleton" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <UsedGearListings searchParams={listingSearchParams} />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
