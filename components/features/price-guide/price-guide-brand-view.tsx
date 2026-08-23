import Image from "next/image"
import Link from "next/link"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { PriceGuideBreadcrumbs } from "@/components/features/price-guide/price-guide-breadcrumbs"
import { PriceGuideConfidencePill } from "@/components/features/price-guide/price-guide-confidence"
import { PriceGuideCompsTable } from "@/components/features/price-guide/price-guide-comps-table"
import { PriceGuideLiveListings } from "@/components/features/price-guide/price-guide-live-listings"
import { PriceGuideRange, PriceGuideRangeBar } from "@/components/features/price-guide/price-guide-range"
import { priceGuideCategoryHref } from "@/lib/price-guide/categories"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideBrandPage } from "@/lib/types/price-guide"

export function PriceGuideBrandView({ page }: { page: PriceGuideBrandPage }) {
  const logoSrc = page.brand.logo_url?.trim() ? brandLogoDisplaySrc(page.brand.logo_url) : ""
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <PriceGuideBreadcrumbs
            crumbs={[
              { label: page.category_label, href: priceGuideCategoryHref(page.category_slug) },
              { label: page.brand.name },
            ]}
          />
          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl border border-border/80 bg-background object-contain"
                />
              ) : null}
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {page.brand.name} prices
                </h1>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  {page.entry?.headline ||
                    `Used ${page.category_label.toLowerCase()} values for ${page.brand.name} on Reswell.`}
                </p>
                <Link
                  href={`/brands/${page.brand.slug}`}
                  className="mt-3 inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Brand profile
                </Link>
              </div>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-background p-6">
              <PriceGuideRange typical={page.typical} size="lg" />
              <PriceGuideRangeBar typical={page.typical} />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {page.sold.count} sold · {page.asking.count} listed
                </p>
                <PriceGuideConfidencePill confidence={page.confidence} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">Models</h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Typical</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Sold / listed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {page.models.map((model) => (
                  <tr key={model.href}>
                    <td className="px-4 py-3">
                      <Link href={model.href} className="font-medium text-foreground hover:underline">
                        {model.model_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatGuideUsd(model.typical.mid_usd)}
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                      {model.sold.count} / {model.asking.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page.models.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No model-level pricing yet. List a {page.brand.name} board to start the book.
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-t border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">Recent sales</h2>
          <div className="mt-6">
            <PriceGuideCompsTable comps={page.recent_sold} />
          </div>
        </div>
      </section>

      <PriceGuideLiveListings listings={page.live_listings} heading={`Live ${page.brand.name} listings`} />
    </main>
  )
}
