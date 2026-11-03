"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { BRANDS_BASE } from "@/lib/brands/routes"
import type { BrandRow } from "@/lib/brands/types"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { BrandsLocalPager } from "@/components/brands/brands-local-pager"
import { BrandsPageTransition } from "@/components/brands/brands-page-transition"
import { useViewportFitPageSize } from "@/components/brands/use-viewport-fit-page-size"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { brandDirectoryColumnsForWidth } from "@/lib/brands/viewport-fit-page-size"

function formatCount(n: number): string {
  return n.toLocaleString("en-US")
}

function BrandDirectoryTile({
  entry,
  availableCount,
  soldCount,
}: {
  entry: BrandRow
  availableCount: number
  soldCount: number
}) {
  const metric =
    soldCount > 0
      ? `${formatCount(soldCount)} sold`
      : availableCount > 0
        ? availableCount === 1
          ? "1 available"
          : `${formatCount(availableCount)} available`
        : entry.model_count > 0
          ? entry.model_count === 1
            ? "1 model"
            : `${formatCount(entry.model_count)} models`
          : "Catalog"

  return (
    <Link
      href={`${BRANDS_BASE}/${entry.slug}`}
      className="group flex items-center gap-3 rounded-2xl bg-[#E8EEF6] px-3 py-3 transition-colors hover:bg-[#DCE5F2] sm:gap-3.5 sm:px-3.5 sm:py-3.5"
    >
      <BrandLogoMark
        name={entry.name}
        logoUrl={entry.logo_url}
        className="h-11 w-11 rounded-full border-0 p-1 text-sm sm:h-12 sm:w-12 sm:text-base"
        imageSizes="48px"
        decorative
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold leading-snug tracking-tight text-foreground group-hover:underline sm:text-[15px]">
          {entry.name}
        </h3>
        <p className="mt-0.5 truncate text-xs tabular-nums text-foreground/70 sm:text-sm">{metric}</p>
      </div>
    </Link>
  )
}

export function BrandsExplorer({
  brands,
  categoryFilter = [],
  activeListingCountByBrandId = {},
  soldListingCountByBrandId = {},
}: {
  brands: BrandRow[]
  categoryFilter?: readonly BrandProductCategorySlug[]
  /** Active peer-marketplace listings linked via `listings.brand_id`. */
  activeListingCountByBrandId?: Readonly<Record<string, number>>
  /** Public sold listings linked via `listings.brand_id`. */
  soldListingCountByBrandId?: Readonly<Record<string, number>>
}) {
  const filterLabel =
    categoryFilter.length > 0
      ? categoryFilter.map((slug) => brandProductCategoryLabel(slug)).join(", ")
      : null

  const listRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(1)
  const filterKey = categoryFilter.join(",")

  const pageSize = useViewportFitPageSize({
    listRef,
    columnsForWidth: brandDirectoryColumnsForWidth,
    fallbackItemHeight: 84,
    fallbackPageSize: 15,
    minPageSize: 5,
    maxPageSize: 40,
    enabled: brands.length > 0,
  })

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  const totalPages = Math.max(1, Math.ceil(brands.length / pageSize))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageBrands = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return brands.slice(start, start + pageSize)
  }, [brands, pageSize, safePage])

  function goToPage(next: number) {
    setPage(next)
  }

  return (
    <section className="bg-background" aria-labelledby="brands-grid-heading">
      <div className="container mx-auto max-w-6xl px-4 pb-14 pt-2 sm:px-6 sm:pb-20">
        <h2 id="brands-grid-heading" className="sr-only">
          All brands
        </h2>

        {filterLabel ? (
          <p className="mb-5 text-sm text-muted-foreground">
            Showing brands tagged with {filterLabel}.
          </p>
        ) : null}

        {brands.length > 0 ? (
          <>
            <BrandsPageTransition page={safePage} heightKey={pageSize}>
              <ul
                ref={listRef}
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              >
                {pageBrands.map((entry) => (
                  <li key={entry.slug}>
                    <BrandDirectoryTile
                      entry={entry}
                      availableCount={activeListingCountByBrandId[entry.id] ?? 0}
                      soldCount={soldListingCountByBrandId[entry.id] ?? 0}
                    />
                  </li>
                ))}
              </ul>
            </BrandsPageTransition>
            <BrandsLocalPager
              page={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={brands.length}
              onPageChange={goToPage}
              label="Brand directory pages"
            />
          </>
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
