import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeInSection } from "@/components/fade-in-section"
import { HomeTrendingBrandsAdminBar } from "@/components/features/home/home-trending-brands-admin-bar"
import { TrendingBrandsStrip, type TrendingStripBrand } from "@/components/features/home/trending-brands-strip"
import { BRANDS_BASE } from "@/lib/brands/routes"
import type { HomeTrendingBrandRow } from "@/lib/db/home-trending-brands"

function toStripBrands(rows: HomeTrendingBrandRow[]): TrendingStripBrand[] {
  return rows.map((r) => ({
    id: r.brand.id,
    slug: r.brand.slug,
    name: r.brand.name,
    logo_url: r.brand.logo_url,
  }))
}

/**
 * “Trending brands” — populated from `home_trending_brands` curation. Non-admins see this only
 * when at least one brand is selected; admins always see the header and CMS affordance.
 */
export function TrendingBrandsSection({
  rows,
  isAdmin,
}: {
  rows: HomeTrendingBrandRow[]
  isAdmin: boolean
}) {
  const brands = toStripBrands(rows)
  if (brands.length === 0 && !isAdmin) {
    return null
  }

  return (
    <FadeInSection>
      <section className="py-16">
        <div className="container mx-auto">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">Trending brands</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:justify-end">
              {brands.length > 0 && (
                <Button variant="outline" asChild>
                  <Link href={BRANDS_BASE}>
                    All brands
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <HomeTrendingBrandsAdminBar isAdmin={isAdmin} />
            </div>
          </div>

          {brands.length === 0 && isAdmin ? (
            <p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No brands in this strip yet. Use the <span className="font-medium">+</span> button to pick brands
              from the directory. Shoppers won&apos;t see this section until you add at least one.
            </p>
          ) : (
            <TrendingBrandsStrip brands={brands} />
          )}
        </div>
      </section>
    </FadeInSection>
  )
}
