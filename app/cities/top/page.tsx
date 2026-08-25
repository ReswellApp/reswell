import type { Metadata } from "next"
import { MapPin } from "lucide-react"
import { TopCitiesDirectory } from "@/components/features/cities/top-cities-directory"
import { TopCitiesSalesMap } from "@/components/features/cities/top-cities-sales-map"
import { getCachedMarketplaceSalesMap } from "@/lib/cache/marketplace-sales-map"
import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("cities-top")
}

export default async function TopCitiesPage() {
  const [directory, salesMap] = await Promise.all([
    getCachedTopCitiesDirectory(),
    getCachedMarketplaceSalesMap(),
  ])

  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Directory
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              Top cities for surf gear
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Browse every city with active listings on Reswell — then open that city's page
              to shop boards you can pick up locally.
            </p>
            {directory.totalCities > 0 ? (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {directory.totalCities} cit{directory.totalCities === 1 ? "y" : "ies"}
                <span aria-hidden>·</span>
                {directory.totalListings.toLocaleString()} active listing
                {directory.totalListings !== 1 ? "s" : ""}
              </p>
            ) : null}
          </div>

          <div className="mx-auto mt-8 max-w-5xl">
            <TopCitiesSalesMap data={salesMap} />
          </div>
        </div>
      </section>

      <TopCitiesDirectory cities={directory.cities} />
    </main>
  )
}
