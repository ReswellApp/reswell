import Link from "next/link"
import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
import { PriceGuideCompsTable } from "@/components/features/price-guide/price-guide-comps-table"
import { PriceGuideRange, PriceGuideRangeBar } from "@/components/features/price-guide/price-guide-range"
import { formatGuideUsd } from "@/lib/price-guide/format"
import { priceGuideModelHref } from "@/lib/price-guide/categories"
import type { PriceGuideModelPage } from "@/lib/types/price-guide"

export function ModelPriceGuidePanel({
  page,
  brandSlug,
  modelSlug,
}: {
  page: PriceGuideModelPage | null
  brandSlug: string
  modelSlug: string
}) {
  if (!page) {
    return (
      <div>
        <ModelPageSectionHeading>Price guide</ModelPageSectionHeading>
        <p className="mt-6 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
          We&apos;re still gathering sold comps for this model.
        </p>
      </div>
    )
  }

  const fullHref = priceGuideModelHref(page.category_slug, brandSlug, modelSlug)

  return (
    <div className="space-y-8">
      <ModelPageSectionHeading>Price guide</ModelPageSectionHeading>
      <section className="rounded-2xl border border-border/80 bg-neutral-50 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estimated price range
        </p>
        <PriceGuideRange typical={page.typical} size="lg" className="mt-2" />
        <PriceGuideRangeBar typical={page.typical} />
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Sold median</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
              {formatGuideUsd(page.sold.median_usd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Asking median</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
              {formatGuideUsd(page.asking.median_usd)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sold sample</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-foreground">{page.sold.count}</dd>
          </div>
        </dl>
      </section>

      {page.condition_bands.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">By condition</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 bg-background">
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
                    <td className="px-4 py-3 font-semibold tabular-nums">{formatGuideUsd(band.mid_usd)}</td>
                    <td className="hidden px-4 py-3 tabular-nums text-muted-foreground sm:table-cell">
                      {formatGuideUsd(band.low_usd)} – {formatGuideUsd(band.high_usd)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{band.sample_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-foreground">Recent sales</h3>
        <div className="mt-3">
          <PriceGuideCompsTable comps={page.recent_sold} />
        </div>
        <p className="mt-4 text-sm">
          <Link href={fullHref} className="font-medium text-foreground underline-offset-4 hover:underline">
            View full price guide
          </Link>
        </p>
      </section>
    </div>
  )
}
