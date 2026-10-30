import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { ModelPricingActions } from "@/components/features/pricing/model-pricing-actions"
import { ModelPricingSales } from "@/components/features/pricing/model-pricing-sales"
import {
  pricingBodyClassName,
  pricingCardClassName,
  pricingChevronClassName,
  pricingCrumbHoverClassName,
  pricingLinkClassName,
  pricingMutedClassName,
  pricingPageClassName,
  pricingStatValueClassName,
  pricingThumbClassName,
  pricingTitleClassName,
} from "@/components/features/pricing/pricing-brand-styles"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { ModelPricingViewModel } from "@/lib/pricing/model-pricing"
import { cn } from "@/lib/utils"

export function ModelPricingView({ page }: { page: ModelPricingViewModel }) {
  return (
    <main className={pricingPageClassName}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <PricingBreadcrumbs crumbs={page.crumbs} />
        <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.92fr)_15.75rem]">
          <IdentityCard page={page} />
          <StatsCard page={page} />
          <ModelPricingActions page={page} />
        </div>
        <ModelPricingSales sales={page.sales} />
      </div>
    </main>
  )
}

function PricingBreadcrumbs({ crumbs }: { crumbs: ModelPricingViewModel["crumbs"] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={cn("flex flex-wrap items-center gap-1.5 text-[13px]", pricingMutedClassName)}>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <ChevronRight className={pricingChevronClassName} aria-hidden /> : null}
              {crumb.href && !last ? (
                <Link href={crumb.href} className={pricingCrumbHoverClassName}>
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? cn("font-medium", pricingBodyClassName) : undefined}>
                  {crumb.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function IdentityCard({ page }: { page: ModelPricingViewModel }) {
  return (
    <section className={cn(pricingCardClassName, "flex gap-4 p-4 sm:p-5")}>
      <div className={cn("relative h-[6.5rem] w-[4.75rem] shrink-0 overflow-hidden rounded-md", pricingThumbClassName)}>
        {page.imageUrl ? (
          <Image
            src={page.imageUrl}
            alt={page.imageAlt}
            fill
            priority
            sizes="76px"
            unoptimized={listingImageShouldBypassOptimization(page.imageUrl)}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <BrandLogoMark
              name={page.brandName}
              logoUrl={page.brandLogoUrl}
              className="h-10 w-10 rounded-md text-xs"
              imageSizes="40px"
            />
          </div>
        )}
      </div>
      <div className="min-w-0 py-0.5">
        <h1 className={cn("text-xl font-bold leading-snug tracking-tight sm:text-[1.35rem]", pricingTitleClassName)}>
          {page.title}
        </h1>
        <p className={cn("mt-0.5 text-[15px] font-semibold", pricingBodyClassName)}>
          by{" "}
          <Link href={page.brandHref} className="hover:underline">
            {page.brandName}
          </Link>
        </p>
        {page.specLine ? <p className={cn("mt-1 text-[13px]", pricingMutedClassName)}>{page.specLine}</p> : null}
        <p className="mt-2">
          <Link href={page.categoryHref} className={cn("text-[15px]", pricingLinkClassName)}>
            {page.categoryLabel}
          </Link>
        </p>
        {page.locationLabel ? (
          <p className={cn("mt-1 text-[15px] leading-6 dark:text-muted-foreground", pricingMutedClassName)}>
            {page.locationLabel}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function StatsCard({ page }: { page: ModelPricingViewModel }) {
  return (
    <section className={cn(pricingCardClassName, "px-5 py-5 sm:px-6 sm:py-6")}>
      <p className={cn("text-[15px]", pricingBodyClassName)}>
        <span className="font-semibold">{page.salesCountLabel}</span>
        <span> {page.salesNoun}</span>
        <span className={pricingMutedClassName}> · </span>
        <Link href={page.listingsHref} className={pricingLinkClassName}>
          {page.liveListingsLabel}
        </Link>
      </p>
      <p className={cn("mt-5 text-[11px] font-semibold uppercase tracking-[0.14em]", pricingMutedClassName)}>
        Range
      </p>
      <p
        className={cn(
          "mt-1 text-[1.65rem] font-bold leading-none tracking-tight tabular-nums",
          pricingTitleClassName,
        )}
      >
        {page.rangeLabel}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-6">
        <Stat label="Avg" value={page.avgLabel} />
        <Stat label="Median" value={page.medianLabel} />
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", pricingMutedClassName)}>{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", pricingStatValueClassName)}>{value}</p>
    </div>
  )
}
