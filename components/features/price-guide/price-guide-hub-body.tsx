import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { PriceGuideConfidencePill } from "@/components/features/price-guide/price-guide-confidence"
import { PriceGuideCompsTable } from "@/components/features/price-guide/price-guide-comps-table"
import { PriceGuideSearch } from "@/components/features/price-guide/price-guide-search"
import { formatGuideUsd, formatListingCount } from "@/lib/price-guide/format"
import type { PriceGuideHub } from "@/lib/types/price-guide"

type PriceGuideHubBodyProps = {
  hub: PriceGuideHub
}

export function PriceGuideHubBody({ hub }: PriceGuideHubBodyProps) {
  return (
    <>
      <section className="border-b border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Reswell Price Guide
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-5xl">
              What surf gear is actually worth
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Live asking prices and sold comps from the Reswell marketplace — organized by
              category, brand, and model. The reference surfers use before they list or buy.
            </p>
            <div className="mx-auto mt-8 max-w-xl">
              <PriceGuideSearch hits={hub.search_index} />
            </div>
          </div>

          <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            <PulseStat label="Active listings" value={hub.pulse.active_listings.toLocaleString()} />
            <PulseStat label="Sold comps" value={hub.pulse.sold_comps.toLocaleString()} />
            <PulseStat label="Brands tracked" value={hub.pulse.brands_covered.toLocaleString()} />
            <PulseStat
              label="Median used board"
              value={formatGuideUsd(hub.pulse.median_surfboard_usd)}
            />
          </dl>
        </div>
      </section>

      <section className="bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Browse by gear
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every category uses the same market: listings on Reswell plus completed sales.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hub.categories.map((card) => (
              <Link
                key={card.slug}
                href={card.href}
                className="group rounded-2xl border border-border/80 bg-offwhite/60 p-5 transition-colors hover:border-foreground/20 hover:bg-offwhite"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{card.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{card.blurb}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                </div>
                <p className="mt-5 text-2xl font-semibold tabular-nums text-foreground">
                  {formatGuideUsd(card.typical.mid_usd)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Typical used · {formatListingCount(card.listing_count)} · {card.sold.count} sold
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {hub.featured.length > 0 ? (
        <section className="border-t border-border/80 bg-offwhite">
          <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Models with the strongest pricing signal
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Brands and models with enough marketplace activity to show a usable range.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {hub.featured.map((model) => (
                <Link
                  key={model.href}
                  href={model.href}
                  className="rounded-2xl border border-border/80 bg-background p-5 transition-colors hover:border-foreground/20"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {model.brand_name}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">{model.model_name}</h3>
                  <p className="mt-4 text-2xl font-semibold tabular-nums text-foreground">
                    {formatGuideUsd(model.typical.mid_usd)}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {model.sold_count} sold · {model.asking_count} listed
                    </span>
                    <PriceGuideConfidencePill confidence={model.confidence} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border/80 bg-background">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Recent market sales
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Completed Reswell checkouts, marked-sold listings, and recorded comps.
              </p>
            </div>
            <Link href="/sold" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
              Sold feed
            </Link>
          </div>
          <PriceGuideCompsTable comps={hub.recent_sold} />
        </div>
      </section>

      <section className="border-t border-border/80 bg-offwhite">
        <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            How Reswell prices gear
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <MethodCard
              title="Marketplace asks"
              body="Active listings on Reswell — the prices sellers are asking right now, by brand and model."
            />
            <MethodCard
              title="Sold comps"
              body="Confirmed checkout totals, recorded snapshot sales, and seller-marked sold prices when a board leaves the market."
            />
            <MethodCard
              title="Editorial review"
              body="Reswell staff attach notes, retail context, and off-platform comps so thin categories still have a usable range."
            />
          </div>
        </div>
      </section>
    </>
  )
}

function PulseStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4 text-left shadow-sm">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function MethodCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
