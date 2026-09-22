import Image from "next/image"
import Link from "next/link"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { ModelPageStars } from "@/components/features/models/model-page-stars"
import { Button } from "@/components/ui/button"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { formatBoardType } from "@/lib/listing-labels"
import { LIST_YOUR_SURFBOARD_SELL_HREF } from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { SaveEntitySearchButton } from "@/components/features/saved-search/save-entity-search-button"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { formatGuideUsd, formatGuideUsdRange } from "@/lib/price-guide/format"
import type { ModelPageData } from "@/lib/services/modelPage"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function ModelPageHeader({
  page,
  criteria,
  isLoggedIn,
  initialSavedSearchId,
}: {
  page: ModelPageData
  criteria: BoardSavedSearchCriteria
  isLoggedIn: boolean
  initialSavedSearchId: string | null
}) {
  const { brand, model, priceGuide, reviewStats } = page
  const imageUrl = page.listingImageUrl
  const typical = priceGuide?.typical
  const usedRange = typical
    ? formatGuideUsdRange(typical.low_usd, typical.high_usd)
    : null
  const newRetail = typical?.new_retail_usd != null ? formatGuideUsd(typical.new_retail_usd) : null
  const boardType = formatBoardType(model.board_category_slug)
  const hasPrice = Boolean(usedRange && usedRange !== "Gathering comps")
  const meta = [brandProductCategoryLabel(model.product_category_slug), boardType]
    .filter(Boolean)
    .join(" · ")
  const madeIn = brand.location_label?.trim() || null
  const construction = uniqueJoined(page.variants.map((row) => row.material?.replace(/_/g, " ")))
  const heroSpecs = [
    boardType ? { label: "Type", value: boardType } : null,
    madeIn ? { label: "Made in", value: madeIn } : null,
    construction ? { label: "Construction", value: construction } : null,
  ].filter((row): row is { label: string; value: string } => row !== null)

  return (
    <header className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-12 xl:gap-16">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-xl bg-muted/50 lg:mx-0 lg:max-w-[26rem]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${brand.name} ${model.name}`}
            fill
            priority
            sizes="(max-width: 1024px) 24rem, 26rem"
            unoptimized={listingImageShouldBypassOptimization(imageUrl)}
            className="object-contain p-4"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BrandLogoMark
              name={brand.name}
              logoUrl={brand.logo_url}
              className="h-28 w-28 rounded-2xl text-2xl"
              imageSizes="112px"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 lg:pt-1">
        <Link
          href={`${BRANDS_BASE}/${brand.slug}`}
          className="text-[15px] font-semibold text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
        >
          {brand.name}
        </Link>
        <h1 className="mt-1 text-balance text-[2rem] font-bold leading-snug tracking-[-0.025em] text-foreground xl:text-[2.125rem]">
          {model.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
          {meta ? <span>{meta}</span> : null}
          {reviewStats.reviewCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <ModelPageStars rating={reviewStats.avgRating} />
              <span className="tabular-nums">
                {reviewStats.avgRating.toFixed(1)} ({reviewStats.reviewCount})
              </span>
            </span>
          ) : null}
        </p>

        {hasPrice ? (
          <div className="mt-5">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-foreground xl:text-[2.625rem] xl:leading-none">
              {usedRange}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Estimated used value
              {newRetail ? ` · Typical new ${newRetail}` : ""}
            </p>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Price guide is still gathering comps.</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <SaveEntitySearchButton
            criteria={criteria}
            label="Save this model"
            savedLabel="Model saved"
            savedSearchLabel={`${brand.name} ${model.name}`}
            successTitle="Model saved"
            successDescription={`We'll email you when a ${brand.name} ${model.name} is listed on Reswell.`}
            isLoggedIn={isLoggedIn}
            initialSavedSearchId={initialSavedSearchId}
          />
          <Button asChild variant="outline" className="rounded-full">
            <Link href={LIST_YOUR_SURFBOARD_SELL_HREF}>Sell yours</Link>
          </Button>
        </div>

        {heroSpecs.length > 0 ? (
          <dl className="mt-8 divide-y divide-neutral-200/90 border-y border-neutral-200/90 dark:divide-neutral-700/70 dark:border-neutral-700/70">
            {heroSpecs.map((spec) => (
              <div
                key={spec.label}
                className="grid grid-cols-[minmax(7.25rem,38%)_minmax(0,1fr)] items-baseline gap-x-4 py-2"
              >
                <dt className="text-[13px] font-medium text-muted-foreground">{spec.label}</dt>
                <dd className="min-w-0 text-[13px] leading-snug text-foreground">{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  )
}

function uniqueJoined(values: Array<string | null | undefined>): string | null {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const label = value?.trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    out.push(label)
  }
  return out.length > 0 ? out.join(", ") : null
}
