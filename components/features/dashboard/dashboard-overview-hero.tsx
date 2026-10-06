import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight, ChevronRight, Plus, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OverviewAttention } from "@/components/features/dashboard/dashboard-overview-live"
import { formatUsd } from "@/lib/utils/format-usd"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { DashboardOverviewModel } from "@/components/features/dashboard/dashboard-overview-model"

interface DashboardOverviewHeroProps {
  model: DashboardOverviewModel
}

export function DashboardOverviewHero({ model }: DashboardOverviewHeroProps) {
  const listingHint =
    model.listingCount > model.activeListings
      ? `${model.listingCount.toLocaleString()} total`
      : "Active now"

  const stats = [
    {
      label: "Sales",
      hint: "Orders sold",
      value: model.sellerOrderCount.toLocaleString(),
      href: "/dashboard/sales",
    },
    {
      label: "Listings",
      hint: listingHint,
      value: model.activeListings.toLocaleString(),
      href: "/dashboard/listings",
    },
    {
      label: "Purchases",
      hint: "Orders bought",
      value: model.buyerOrderCount.toLocaleString(),
      href: "/dashboard/purchases",
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border sm:h-14 sm:w-14">
            {model.profileImageUrl ? (
              <Image
                src={model.profileImageUrl}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
                unoptimized={listingImageShouldBypassOptimization(model.profileImageUrl)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden>
                <UserCircle className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="hidden text-[13px] text-muted-foreground lg:block">Welcome back</p>
            <h1 className="hidden truncate font-headline text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground lg:block">
              {model.name}
            </h1>
            <p className="truncate font-headline text-lg font-semibold leading-tight tracking-tight text-foreground lg:hidden">
              {model.name}
            </p>
            {model.location || model.shopHref ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {model.location}
                {model.location && model.shopHref ? <span aria-hidden> · </span> : null}
                {model.shopHref ? (
                  <Link href={model.shopHref} className="font-medium text-foreground underline-offset-4 hover:underline">
                    View shop
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>

          <Button variant="ghost" size="sm" className="shrink-0 lg:hidden" asChild>
            <Link href="/dashboard/profile">Profile</Link>
          </Button>
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Button variant="outline" asChild>
              <Link href="/dashboard/profile">Profile</Link>
            </Button>
            <Button asChild>
              <Link href="/sell?new=1">
                <Plus aria-hidden />
                Create listing
              </Link>
            </Button>
          </div>
        </div>

        <Button className="h-11 w-full lg:hidden" asChild>
          <Link href="/sell?new=1">
            <Plus aria-hidden />
            Create listing
          </Link>
        </Button>
      </header>

      <OverviewAttention
        pendingOffers={model.pendingOffers}
        unreadCount={model.unreadCount}
        unreadSupportCount={model.unreadSupportCount}
        newFollowersThisMonth={model.newFollowersThisMonth}
      />

      <section aria-label="Account snapshot" className="grid items-stretch gap-3 lg:grid-cols-5 lg:gap-4">
        <Link
          href="/dashboard/earnings"
          className="group block h-full rounded-2xl bg-foreground text-white shadow-soft outline-none transition-colors hover:bg-[#12151c] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-white dark:text-[#04070E] dark:hover:bg-neutral-100 lg:col-span-3"
        >
          <div className="flex h-full min-h-[12.5rem] flex-col justify-between p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/60 dark:text-[#04070E]/55">
                Available
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-white/80 transition-transform group-hover:translate-x-0.5 dark:text-[#04070E]/70">
                Earnings
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="font-headline mt-6 text-[clamp(2.25rem,6vw,3.25rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              {formatUsd(model.walletBalance)}
            </p>
            <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-white/15 pt-4 dark:border-black/10">
              <p className="text-sm text-white/65 dark:text-[#04070E]/60">Lifetime earned</p>
              <p className="text-sm font-medium tabular-nums">{formatUsd(model.lifetimeEarned)}</p>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="flex min-h-[4.75rem] items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {stat.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{stat.hint}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-headline text-[1.75rem] font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-3xl">
                  {stat.value}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
