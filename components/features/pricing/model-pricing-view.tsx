import Image from "next/image"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { ModelPricingActions } from "@/components/features/pricing/model-pricing-actions"
import { ModelPricingSales } from "@/components/features/pricing/model-pricing-sales"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { ModelPricingViewModel } from "@/lib/pricing/model-pricing"
import { cn } from "@/lib/utils"

const cardClassName =
  "rounded-2xl border border-[#e6eaf2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border dark:bg-card"

export function ModelPricingView({ page }: { page: ModelPricingViewModel }) {
  return (
    <main className="flex-1 bg-[#f5f7fb] text-[#162033] dark:bg-background dark:text-foreground">
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
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#6b7689]">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[#9aa3b2]" aria-hidden /> : null}
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-[#162033] dark:hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? "font-medium text-[#1c2740] dark:text-foreground" : undefined}>
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
    <section className={cn(cardClassName, "flex gap-4 p-4 sm:p-5")}>
      <div className="relative h-[6.5rem] w-[4.75rem] shrink-0 overflow-hidden rounded-md bg-[#eef0f4] dark:bg-muted">
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
        <h1 className="text-xl font-bold leading-snug tracking-tight text-[#121a2b] dark:text-foreground sm:text-[1.35rem]">
          {page.title}
        </h1>
        <p className="mt-0.5 text-[15px] font-semibold text-[#1c2740] dark:text-foreground">
          by{" "}
          <Link href={page.brandHref} className="hover:underline">
            {page.brandName}
          </Link>
        </p>
        {page.specLine ? <p className="mt-1 text-[13px] text-[#8b95a7]">{page.specLine}</p> : null}
        <p className="mt-2">
          <Link href={page.categoryHref} className="text-[15px] font-medium text-[#3c5fe0] hover:underline">
            {page.categoryLabel}
          </Link>
        </p>
        {page.locationLabel ? (
          <p className="mt-1 text-[15px] leading-6 text-[#5c677a] dark:text-muted-foreground">{page.locationLabel}</p>
        ) : null}
      </div>
    </section>
  )
}

function StatsCard({ page }: { page: ModelPricingViewModel }) {
  return (
    <section className={cn(cardClassName, "px-5 py-5 sm:px-6 sm:py-6")}>
      <p className="text-[15px] text-[#1c2740] dark:text-foreground">
        <span className="font-semibold">{page.salesCountLabel}</span>
        <span> {page.salesNoun}</span>
        <span className="text-[#8b95a7]"> · </span>
        <Link href={page.listingsHref} className="font-medium text-[#3c5fe0] hover:underline">
          {page.liveListingsLabel}
        </Link>
      </p>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b95a7]">Range</p>
      <p className="mt-1 text-[1.65rem] font-bold leading-none tracking-tight text-[#121a2b] tabular-nums dark:text-foreground">
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b95a7]">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-[#3451c7] dark:text-[#9eb0f5]">{value}</p>
    </div>
  )
}
