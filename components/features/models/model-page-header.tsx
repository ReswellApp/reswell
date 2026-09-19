import Image from "next/image"
import Link from "next/link"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { ModelPageStars } from "@/components/features/models/model-page-stars"
import { Button } from "@/components/ui/button"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { brandProductCategoryLabel } from "@/lib/brand-product-categories"
import { formatBoardType } from "@/lib/listing-labels"
import { LIST_YOUR_SURFBOARD_SELL_HREF } from "@/components/features/marketing/list-your-surfboard-sell-cta"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { formatGuideUsd, formatGuideUsdRange } from "@/lib/price-guide/format"
import type { ModelPageData } from "@/lib/services/modelPage"

export function ModelPageHeader({ page }: { page: ModelPageData }) {
  const { brand, model, priceGuide, reviewStats } = page
  const imageUrl = page.listingImageUrl
  const typical = priceGuide?.typical
  const usedRange = typical
    ? formatGuideUsdRange(typical.low_usd, typical.high_usd)
    : null
  const newRetail = typical?.new_retail_usd != null ? formatGuideUsd(typical.new_retail_usd) : null
  const boardType = formatBoardType(model.board_category_slug)

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {imageUrl ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="80px"
              unoptimized={listingImageShouldBypassOptimization(imageUrl)}
              className="object-cover"
            />
          </div>
        ) : (
          <BrandLogoMark
            name={brand.name}
            logoUrl={brand.logo_url}
            className="h-16 w-16 rounded-xl text-lg sm:h-20 sm:w-20"
            imageSizes="80px"
          />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {brand.name} {model.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Link
              href={`${BRANDS_BASE}/${brand.slug}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {brand.name}
            </Link>
            <span>{brandProductCategoryLabel(model.product_category_slug)}</span>
            {boardType ? <span>{boardType}</span> : null}
            {reviewStats.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <ModelPageStars rating={reviewStats.avgRating} />
                <span>({reviewStats.reviewCount})</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
        <div className="text-sm sm:text-right">
          {usedRange && usedRange !== "Gathering comps" ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Estimated used value
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{usedRange}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Price guide is still gathering comps.</p>
          )}
          {newRetail ? (
            <p className="mt-1 text-xs text-muted-foreground">Typical new {newRetail}</p>
          ) : null}
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href={LIST_YOUR_SURFBOARD_SELL_HREF}>Sell yours</Link>
        </Button>
      </div>
    </header>
  )
}
