import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CategoryTopShopCard } from "@/components/features/browse/category-top-shop-card"
import { CategoryTopShopsCarousel } from "@/components/features/browse/category-top-shops-carousel"
import { Button } from "@/components/ui/button"
import { getCachedCategoryTopShops } from "@/lib/cache/category-top-shops"
import type { CategoryTopShopSection } from "@/lib/types/category-top-shops"

const COPY: Record<
  CategoryTopShopSection,
  { title: string; label: string }
> = {
  surfboards: {
    title: "Browse more boards from top shops",
    label: "Top shops that ship surfboards",
  },
  fins: {
    title: "Browse more fins from top shops",
    label: "Top shops that ship fins",
  },
}

export async function CategoryTopShopsSection({
  section,
}: {
  section: CategoryTopShopSection
}) {
  const shops = await getCachedCategoryTopShops(section)
  if (shops.length === 0) return null

  const copy = COPY[section]

  return (
    <section className="border-t border-neutral-200 bg-offwhite pt-10 pb-12 sm:pt-12 sm:pb-16">
      <div className="container mx-auto min-w-0">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{copy.title}</h2>
          <Button variant="outline" asChild className="w-fit shrink-0">
            <Link href="/sellers">
              See all sellers
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <CategoryTopShopsCarousel label={copy.label}>
          {shops.map((shop) => (
            <CategoryTopShopCard key={shop.id} shop={shop} />
          ))}
        </CategoryTopShopsCarousel>
      </div>
    </section>
  )
}

export function CategoryTopShopsSectionSkeleton() {
  return (
    <section className="border-t border-neutral-200 bg-offwhite pt-10 pb-12 sm:pt-12 sm:pb-16">
      <div className="container mx-auto min-w-0">
        <div className="mb-6 h-8 w-72 max-w-full rounded-md bg-muted/70 sm:mb-8" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="w-[9.25rem] shrink-0 sm:w-44">
              <div className="aspect-square rounded-xl bg-muted/70" />
              <div className="mt-2.5 h-4 w-3/4 rounded bg-muted/70" />
              <div className="mt-1.5 h-3 w-1/2 rounded bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
