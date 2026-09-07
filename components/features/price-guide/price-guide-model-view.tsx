import Link from "next/link"
import { PriceGuideBreadcrumbs } from "@/components/features/price-guide/price-guide-breadcrumbs"
import { PriceGuideConfidencePill } from "@/components/features/price-guide/price-guide-confidence"
import { PriceGuideCompsTable } from "@/components/features/price-guide/price-guide-comps-table"
import { PriceGuideLiveListings } from "@/components/features/price-guide/price-guide-live-listings"
import { PriceGuideRange, PriceGuideRangeBar } from "@/components/features/price-guide/price-guide-range"
import { priceGuideBrandHref, priceGuideCategoryHref } from "@/lib/price-guide/categories"
import { formatGuideUsd } from "@/lib/price-guide/format"
import type { PriceGuideModelPage } from "@/lib/types/price-guide"

export function PriceGuideModelView({ page }: { page: PriceGuideModelPage }) {
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <PriceGuideBreadcrumbs
            crumbs={[
              { label: page.category_label, href: priceGuideCategoryHref(page.category_slug) },
              { label: page.brand.name, href: priceGuideBrandHref(page.category_slug, page.brand.slug) },
              { label: page.model.name },
            ]}
          />
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {page.brand.name}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            {page.model.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            {page.entry?.headline ||
              `Used ${page.model.name} pricing from Reswell listings and completed sales.`}
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="rounded-2xl border border-border/80 bg-background p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Typical used value
              </p>
              <PriceGuideRange typical={page.typical} size="lg" className="mt-2" />
              <PriceGuideRangeBar typical={page.typical} />
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Stat label="Sold median" value={formatGuideUsd(page.sold.median_usd)} />
                <Stat label="Asking median" value={formatGuideUsd(page.asking.median_usd)} />
                <Stat label="Sold sample" value={String(page.sold.count)} />
              </dl>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background p-6">
              <PriceGuideConfidencePill confidence={page.confidence} showHint />
              <div className="mt-6 space-y-2 text-sm">
                <Link href={page.browse_href} className="block font-medium text-foreground underline-offset-4 hover:underline">
                  Shop this model
                </Link>
                <Link href={page.sell_href} className="block text-muted-foreground underline-offset-4 hover:underline">
                  List yours and add a comp
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {page.entry?.body || page.entry?.summary ? (
        <section className="border-b border-border/80 bg-background">
          <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
            {page.entry.summary ? (
              <p className="text-base leading-relaxed text-foreground">{page.entry.summary}</p>
            ) : null}
            {page.entry.body ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {page.entry.body}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {page.condition_bands.length > 0 ? (
        <section className="border-b border-border/80 bg-background">
          <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-lg font-semibold text-foreground">By condition</h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-border/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">Typical</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Range</th>
                    <th className="px-4 py-3 font-medium">Comps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {page.condition_bands.map((band) => (
                    <tr key={band.condition}>
                      <td className="px-4 py-3 font-medium">{band.condition_label}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">
                        {formatGuideUsd(band.mid_usd)}
                      </td>
                      <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                        {formatGuideUsd(band.low_usd)} – {formatGuideUsd(band.high_usd)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{band.sample_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">Comparable sales</h2>
          <div className="mt-6">
            <PriceGuideCompsTable comps={page.recent_sold} />
          </div>
        </div>
      </section>

      <PriceGuideLiveListings listings={page.live_listings} heading="For sale now" />
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
