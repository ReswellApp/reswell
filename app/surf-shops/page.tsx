import type { Metadata } from "next"
import Link from "next/link"
import { SurfShopsDirectory } from "@/components/features/surf-shops/surf-shops-directory"
import { Button } from "@/components/ui/button"
import { CITY_SURF_SHOPS } from "@/lib/city-landing-surf-shops"
import {
  FOR_SURF_SHOPS_PATH,
  forSurfShopsOfferHref,
  forSurfShopsOfferLabel,
} from "@/lib/for-surf-shops"
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

      <section className="border-b border-border/80 bg-[#001A4A]">
        <div className="container mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-9">
          <div className="max-w-2xl">
            <p className="font-headline text-xl font-bold tracking-tight text-white sm:text-2xl">
              Own a surf shop?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/75 sm:text-base">
              Sell used boards on Reswell with six months of no selling fees.{" "}
              <Link
                href={FOR_SURF_SHOPS_PATH}
                className="font-medium text-white underline underline-offset-4"
              >
                See the shop offer
              </Link>
              .
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="shrink-0 rounded-full bg-white px-7 font-semibold text-[#001A4A] hover:bg-white/90"
          >
            <Link href={forSurfShopsOfferHref()}>{forSurfShopsOfferLabel()}</Link>
          </Button>
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
