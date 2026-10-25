import Link from "next/link"
import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
import { PriceGuideRangeBar } from "@/components/features/price-guide/price-guide-range"
import { formatStoredListingDimensions } from "@/lib/listing-dimensions-display"
import { listingDetailHref } from "@/lib/listing-href"
import { formatCondition } from "@/lib/listing-labels"
import { formatCompCount, formatGuideUsd } from "@/lib/price-guide/format"
import { modelPricingHref } from "@/lib/pricing/model-pricing"
import { modelUsedRangeLabel } from "@/lib/models/model-page-hero"
import type { ModelMarketplaceListing } from "@/lib/db/brand-listings"
import type { PriceGuideComp, PriceGuideModelPage } from "@/lib/types/price-guide"

const SALE_ROW_LIMIT = 8

type SaleRow = {
  id: string
  detail: string
  meta: string
  price: string
  href: string | null
}

function formatSoldOn(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (!match) return raw.trim()
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function rowHref(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith("/")) return url
  try {
    const parsed = new URL(url)
    if (parsed.hostname === "reswell.app" || parsed.hostname === "www.reswell.app") {
      return `${parsed.pathname}${parsed.search}`
    }
  } catch {
    return null
  }
  return url
}

function rowsFromComps(comps: PriceGuideComp[]): SaleRow[] {
  return comps.slice(0, SALE_ROW_LIMIT).map((comp) => {
    const source = comp.source_label.trim()
    const meta = [
      formatSoldOn(comp.sold_at),
      comp.condition_label,
      source && source !== "Sold on Reswell" ? source : null,
    ]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" · ")
    return {
      id: comp.id,
      detail: formatStoredListingDimensions(comp.dimensions) || comp.title?.trim() || "Sold board",
      meta,
      price: formatGuideUsd(comp.sold_price_usd),
      href: rowHref(comp.listing_url),
    }
  })
}

function rowsFromSold(listings: ModelMarketplaceListing[]): SaleRow[] {
  return listings.slice(0, SALE_ROW_LIMIT).map((listing) => ({
    id: listing.id,
    detail: listing.board_length?.trim() || listing.title,
    meta: [formatSoldOn(listing.updated_at ?? ""), formatCondition(listing.condition) || null]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" · "),
    price: formatGuideUsd(Number(listing.price)),
    href: listingDetailHref(listing),
  }))
}

function SaleRows({ rows }: { rows: SaleRow[] }) {
  if (rows.length === 0) return null
  return (
    <ul className="mt-6 divide-y divide-border/70 border-t border-border/70">
      {rows.map((row) => {
        const body = (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{row.detail}</p>
              {row.meta ? <p className="mt-0.5 text-xs text-muted-foreground">{row.meta}</p> : null}
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{row.price}</p>
          </>
        )
        const className = "flex items-baseline justify-between gap-4 py-3.5"
        return (
          <li key={row.id}>
            {row.href?.startsWith("/") ? (
              <Link href={row.href} className={`${className} hover:opacity-80`}>
                {body}
              </Link>
            ) : row.href ? (
              <a href={row.href} className={`${className} hover:opacity-80`}>
                {body}
              </a>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ModelPriceGuidePanel({
  page,
  soldListings,
  listingCount,
  brandSlug,
  modelSlug,
}: {
  page: PriceGuideModelPage | null
  soldListings: ModelMarketplaceListing[]
  listingCount: number
  brandSlug: string
  modelSlug: string
}) {
  const range = modelUsedRangeLabel(page?.typical.low_usd, page?.typical.high_usd)
  const rows = page && page.recent_sold.length > 0 ? rowsFromComps(page.recent_sold) : rowsFromSold(soldListings)
  const emphasizeRange = listingCount > 0 && Boolean(range)
  const bands = (page?.condition_bands ?? []).filter((band) => band.sample_count > 0)
  const stats = [
    page?.typical.mid_usd != null ? `${formatGuideUsd(page.typical.mid_usd)} typical` : null,
    page && page.asking.count > 0 && page.asking.median_usd != null
      ? `${formatGuideUsd(page.asking.median_usd)} asking`
      : null,
    page && page.sold.count > 0 ? formatCompCount(page.sold.count) : null,
    page?.typical.new_retail_usd != null ? `${formatGuideUsd(page.typical.new_retail_usd)} new` : null,
  ].filter((part): part is string => Boolean(part))

  return (
    <div className="rounded-2xl border border-border/80 bg-neutral-50 p-6 sm:p-8">
      <ModelPageSectionHeading>
        {emphasizeRange ? "What it sells for" : "Recent sales"}
      </ModelPageSectionHeading>
      {emphasizeRange && range ? (
        <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">{range}</p>
      ) : null}
      {stats.length > 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{stats.join(" · ")}</p>
      ) : null}
      {emphasizeRange && page ? <PriceGuideRangeBar typical={page.typical} /> : null}
      {bands.length > 1 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {bands
            .map((band) => `${band.condition_label} ${formatGuideUsd(band.mid_usd)}`)
            .join(" · ")}
        </p>
      ) : null}
      <SaleRows rows={rows} />
      <p className="mt-4 text-sm">
        <Link
          href={modelPricingHref(brandSlug, modelSlug)}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Pricing
        </Link>
      </p>
    </div>
  )
}
