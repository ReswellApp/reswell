import type { Metadata } from "next"
import { SurfShopsDirectory } from "@/components/features/surf-shops/surf-shops-directory"
import { CITY_SURF_SHOPS } from "@/lib/city-landing-surf-shops"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("surf-shops")
}

export default function SurfShopsIndexPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Directory
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              Surf shops
            </h1>
            <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">
              Independent shops we feature on city pages — visit in person, then browse used boards nearby.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <SurfShopsDirectory shops={CITY_SURF_SHOPS} />
        </div>
      </section>
    </main>
  )
}
