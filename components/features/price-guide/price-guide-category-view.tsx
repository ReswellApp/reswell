import Link from "next/link"
import { PriceGuideBreadcrumbs } from "@/components/features/price-guide/price-guide-breadcrumbs"
import { PriceGuideConfidencePill } from "@/components/features/price-guide/price-guide-confidence"
import { PriceGuideCompsTable } from "@/components/features/price-guide/price-guide-comps-table"
import { PriceGuideRange, PriceGuideRangeBar } from "@/components/features/price-guide/price-guide-range"
import { formatGuideUsd, formatListingCount } from "@/lib/price-guide/format"
import type { PriceGuideCategoryPage } from "@/lib/types/price-guide"

export function PriceGuideCategoryView({ page }: { page: PriceGuideCategoryPage }) {
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <PriceGuideBreadcrumbs crumbs={[{ label: page.category_label }]} />
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {page.category_label} price guide
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-base text-muted-foreground">
                {page.entry?.headline || page.blurb}
              </p>
              {page.entry?.body ? (
                <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {page.entry.body}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <Link href={page.browse_href} className="font-medium text-foreground underline-offset-4 hover:underline">
                  Shop {page.category_label.toLowerCase()}
                </Link>
                <Link href={page.sell_href} className="text-muted-foreground underline-offset-4 hover:underline">
                  List yours
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Typical used value
              </p>
              <PriceGuideRange typical={page.typical} size="lg" className="mt-2" />
              <PriceGuideRangeBar typical={page.typical} />
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {page.sold.count} sold · {formatListingCount(page.asking.count)} asking
                </p>
                <PriceGuideConfidencePill confidence={page.confidence} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">Brands</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sorted by how much marketplace activity we have.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Typical</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Sold</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Listed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {page.brands.map((brand) => (
                  <tr key={brand.brand_id} className="bg-background">
                    <td className="px-4 py-3">
                      <Link href={brand.href} className="font-medium text-foreground hover:underline">
                        {brand.brand_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {brand.model_count} model{brand.model_count === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatGuideUsd(brand.typical.mid_usd)}
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                      {brand.sold.count}
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums text-muted-foreground md:table-cell">
                      {brand.asking.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {page.brands.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No brand-level comps yet. List a {page.category_label.toLowerCase().replace(/s$/, "")} to start the book.
            </p>
          ) : null}
        </div>
      </section>

      {page.top_models.length > 0 ? (
        <section className="border-t border-border/80 bg-offwhite">
          <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-lg font-semibold text-foreground">Top models</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {page.top_models.map((model) => (
                <Link
                  key={model.href}
                  href={model.href}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-background px-4 py-4"
                >
                  <span>
                    <span className="block font-medium text-foreground">{model.model_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {model.sold.count} sold · {model.asking.count} listed
                    </span>
                  </span>
                  <span className="text-base font-semibold tabular-nums">
                    {formatGuideUsd(model.typical.mid_usd)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border/80 bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-lg font-semibold text-foreground">Recent sales</h2>
          <div className="mt-6">
            <PriceGuideCompsTable comps={page.recent_sold} />
          </div>
        </div>
      </section>
    </main>
  )
}
