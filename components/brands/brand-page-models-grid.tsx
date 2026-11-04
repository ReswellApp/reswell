"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import type { BrandPageModelCard } from "@/lib/brands/model-cards"
import { BrandsLocalPager } from "@/components/brands/brands-local-pager"
import { BrandsPageTransition } from "@/components/brands/brands-page-transition"
import { useViewportFitPageSize } from "@/components/brands/use-viewport-fit-page-size"
import { brandModelColumnsForWidth } from "@/lib/brands/viewport-fit-page-size"
import { modelPageHref } from "@/lib/models/routes"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { isConfiguredNextImageSrc } from "@/lib/brands/logo-mark"
import { cn } from "@/lib/utils"

function formatCount(n: number): string {
  return n.toLocaleString("en-US")
}

function modelMarkInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const letter = trimmed.replace(/^[^A-Za-z0-9#]+/, "").charAt(0)
  return (letter || trimmed.charAt(0)).toUpperCase()
}

function ModelRowThumb({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const src = imageUrl && isConfiguredNextImageSrc(imageUrl) ? imageUrl : null

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted/40 sm:h-[4.5rem] sm:w-[4.5rem]">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="72px"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          unoptimized={listingImageShouldBypassOptimization(src)}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-base font-semibold tracking-tight text-muted-foreground/45">
            {modelMarkInitial(name)}
          </span>
        </div>
      )}
    </div>
  )
}

export function BrandPageModelsGrid({
  brandSlug,
  brandName,
  models,
  className,
}: {
  brandSlug: string
  brandName: string
  models: BrandPageModelCard[]
  className?: string
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: { slug: BrandPageModelCard["product_category_slug"]; label: string }[] = []
    for (const model of models) {
      if (seen.has(model.product_category_slug)) continue
      seen.add(model.product_category_slug)
      out.push({
        slug: model.product_category_slug,
        label: brandProductCategoryLabel(model.product_category_slug),
      })
    }
    return out
  }, [models])

  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all")
  const [page, setPage] = useState(1)

  const visibleModels = useMemo(() => {
    if (categoryFilter === "all") return models
    return models.filter((model) => model.product_category_slug === categoryFilter)
  }, [categoryFilter, models])

  const pageSize = useViewportFitPageSize({
    listRef,
    columnsForWidth: brandModelColumnsForWidth,
    fallbackItemHeight: 96,
    fallbackPageSize: 12,
    minRows: 4,
    minPageSize: 4,
    maxPageSize: 30,
    enabled: visibleModels.length > 0,
  })

  useEffect(() => {
    setPage(1)
  }, [categoryFilter])

  const totalPages = Math.max(1, Math.ceil(visibleModels.length / pageSize))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageModels = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return visibleModels.slice(start, start + pageSize)
  }, [pageSize, safePage, visibleModels])

  function goToPage(next: number) {
    setPage(next)
  }

  if (models.length === 0) return null

  return (
    <section className={cn("mt-10 sm:mt-12", className)} aria-labelledby="brand-models-heading">
      <div>
        <h2 id="brand-models-heading" className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          All models by {brandName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {models.length === 1 ? "1 model" : `${formatCount(models.length)} models`} in the catalog,
          sorted by marketplace activity
        </p>
      </div>

      {categories.length > 1 ? (
        <div className="mt-5 flex flex-wrap gap-2" role="toolbar" aria-label="Filter models by category">
          <button
            type="button"
            aria-pressed={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              categoryFilter === "all"
                ? "bg-[#E8EEF6] text-[#163060]"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              aria-pressed={categoryFilter === category.slug}
              onClick={() => setCategoryFilter(category.slug)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                categoryFilter === category.slug
                  ? "bg-[#E8EEF6] text-[#163060]"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      ) : null}

      <BrandsPageTransition page={safePage} heightKey={pageSize} className="mt-6">
        <ul
          ref={listRef}
          className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {pageModels.map((model) => {
            const available =
              model.active_listing_count > 0
                ? model.active_listing_count === 1
                  ? "1 available"
                  : `${formatCount(model.active_listing_count)} available`
                : null
            const sold =
              model.sold_listing_count > 0
                ? model.sold_listing_count === 1
                  ? "1 sold"
                  : `${formatCount(model.sold_listing_count)} sold`
                : null

            return (
              <li key={model.id}>
                <Link
                  href={modelPageHref(brandSlug, model.slug)}
                  className="group flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-muted/40 sm:gap-3.5"
                >
                  <ModelRowThumb imageUrl={model.listing_image_url} name={model.name} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold tracking-tight text-foreground group-hover:underline sm:text-base">
                      {model.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                      {brandProductCategoryLabel(model.product_category_slug)}
                    </p>
                    {available || sold ? (
                      <p className="mt-1 text-xs tabular-nums text-foreground/70 sm:text-sm">
                        {[available, sold].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </BrandsPageTransition>

      {visibleModels.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No models in this category yet.</p>
      ) : (
        <BrandsLocalPager
          page={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={visibleModels.length}
          onPageChange={goToPage}
          label="Brand models pages"
        />
      )}
    </section>
  )
}
