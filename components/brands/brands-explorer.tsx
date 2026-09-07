"use client"

import Link from "next/link"
import { ArrowUpRight, MapPin } from "lucide-react"
import { BRANDS_BASE } from "@/lib/brands/routes"
import type { BrandRow } from "@/lib/brands/types"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { BrandProductCategoryBadges } from "@/components/brands/brand-product-category-badges"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"

function BrandDirectoryTile({
  entry,
  availableCount,
}: {
  entry: BrandRow
  availableCount: number
}) {
  const availableLabel =
    availableCount === 1 ? "1 available" : `${availableCount} available`

  return (
    <Link
      href={`${BRANDS_BASE}/${entry.slug}`}
      className="group flex h-full flex-col rounded-xl border border-border/80 bg-card p-3 shadow-soft transition-colors hover:border-foreground/20 hover:shadow-soft-hover sm:rounded-2xl sm:p-6"
    >
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
        <BrandLogoMark
          name={entry.name}
          logoUrl={entry.logo_url}
          className="h-14 w-14 rounded-lg text-lg sm:h-[72px] sm:w-[72px] sm:rounded-xl sm:text-2xl"
          imageSizes="(max-width: 640px) 56px, 72px"
        />
        <div className="mt-2.5 min-w-0 flex-1 sm:mt-0 sm:pt-0.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground group-hover:underline sm:text-lg">
            {entry.name}
          </h3>
          {entry.location_label ? (
            <p className="mt-1 hidden items-center gap-1.5 text-sm text-muted-foreground sm:mt-1.5 sm:flex">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-2">{entry.location_label}</span>
            </p>
          ) : null}
        </div>
      </div>

      {entry.short_description ? (
        <p className="mt-4 hidden line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground sm:block">
          {entry.short_description}
        </p>
      ) : (
        <p className="mt-4 hidden flex-1 text-sm text-muted-foreground/80 sm:block">Profile in catalog.</p>
      )}

      {entry.product_categories.length > 0 ? (
        <BrandProductCategoryBadges
          categories={entry.product_categories}
          className="mt-3 hidden sm:mt-4 sm:flex"
          size="sm"
        />
      ) : null}

      <div className="mt-auto flex items-center justify-center gap-3 border-t border-border/60 pt-2.5 sm:mt-5 sm:justify-between sm:pt-4">
        <span className="text-[11px] tabular-nums text-muted-foreground sm:text-xs">{availableLabel}</span>
        <span className="hidden items-center gap-1 text-sm font-medium text-foreground sm:inline-flex">
          View
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  )
}

export function BrandsExplorer({
  brands,
  categoryFilter = [],
  activeListingCountByBrandId = {},
}: {
  brands: BrandRow[]
  categoryFilter?: readonly BrandProductCategorySlug[]
  /** Active peer-marketplace listings linked via `listings.brand_id`. */
  activeListingCountByBrandId?: Readonly<Record<string, number>>
}) {
  const filterLabel =
    categoryFilter.length > 0
      ? categoryFilter.map((slug) => brandProductCategoryLabel(slug)).join(", ")
      : null

  return (
    <section className="bg-background" aria-labelledby="brands-grid-heading">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 id="brands-grid-heading" className="sr-only">
          All brands
        </h2>

        {filterLabel ? (
          <p className="mb-6 text-sm text-muted-foreground">
            Showing brands tagged with {filterLabel}.
          </p>
        ) : null}

        {brands.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {brands.map((entry) => (
              <li key={entry.slug}>
                <BrandDirectoryTile
                  entry={entry}
                  availableCount={activeListingCountByBrandId[entry.id] ?? 0}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {filterLabel
                ? `No brands tagged with ${filterLabel} yet. Try clearing filters or pick another product type.`
                : "No brands in the database yet. After you run the brands migration in Supabase, refresh this page."}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
