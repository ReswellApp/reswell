"use client"

import Link from "next/link"
import {
  Check,
  ChevronRight,
  Clock,
  DollarSign,
  Gift,
  List,
  Star,
  type LucideIcon,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { helpTopicPath } from "@/lib/help-center/paths"
import { earningsHref } from "@/lib/earnings-view"
import { cn } from "@/lib/utils"

export function EarningsHubSkeleton() {
  return (
    <div className={hubCardClass}>
      <Skeleton className="hidden h-8 w-36 lg:block" />
      <div className="mt-5 grid grid-cols-3 divide-x divide-border/70 rounded-xl bg-muted/50 px-2 py-5 sm:px-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 px-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-2 divide-y divide-border/70">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5 py-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const hubCardClass = "rounded-2xl border border-border/70 bg-card px-5 py-6 sm:px-7 sm:py-7"

export function EarningsHub({
  lifetimeLabel,
  last30Label,
  availableLabel,
  pendingLabel,
  readyLabel,
  creditLabel,
  showCredit,
}: {
  lifetimeLabel: string
  last30Label: string
  availableLabel: string
  pendingLabel: string
  readyLabel: string
  creditLabel: string
  /** Admin-only Reswell Credit pilot. */
  showCredit: boolean
}) {
  return (
    <div className={hubCardClass}>
      <h1 className="hidden text-2xl font-bold tracking-tight text-foreground lg:block">Earnings</h1>

      <div className="grid grid-cols-3 divide-x divide-border/60 rounded-xl bg-muted/50 px-1 py-4 lg:mt-5 sm:px-2 sm:py-5">
        <EarningsStat value={lifetimeLabel} label="Lifetime Earnings" />
        <EarningsStat value={last30Label} label="Last 30 Days" />
        <EarningsStat value={availableLabel} label="Available Earnings" />
      </div>

      <div className="mt-1">
        <EarningsMenuLink
          href={earningsHref("pending")}
          icon={Clock}
          title="Pending Release"
          amount={pendingLabel}
        />
        <EarningsMenuLink
          href={earningsHref("available")}
          icon={Check}
          title="Available"
          amount={readyLabel}
        />
        <EarningsMenuLink href={earningsHref("activity")} icon={List} title="Activity" />
        <EarningsMenuLink href={helpTopicPath("selling")} icon={DollarSign} title="Earnings FAQ" />
      </div>

      {showCredit ? (
        <>
          <h2 className="mt-8 text-2xl font-bold tracking-tight text-foreground">Rewards</h2>
          <EarningsMenuLink
            href={earningsHref("credit")}
            icon={Gift}
            title="Reswell Credit"
            amount={creditLabel}
          />

          <Link
            href={helpTopicPath("buying")}
            className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-100 px-3.5 py-3.5 text-left transition-colors hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/55"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
              <Star className="h-4 w-4 fill-current" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-emerald-900 dark:text-emerald-100">
                Earn extra Reswell Credit
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-emerald-800/90 dark:text-emerald-200/90">
                Get credit on purchases, and you can pay with available earnings at checkout.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-emerald-800 dark:text-emerald-200" aria-hidden />
          </Link>
        </>
      ) : null}
    </div>
  )
}

function EarningsStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-2 text-center">
      <p className="text-lg font-bold tabular-nums tracking-tight text-listingHeart sm:text-xl">{value}</p>
      <p className="mt-1 text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}

function EarningsMenuLink({
  href,
  icon: Icon,
  title,
  amount,
}: {
  href: string
  icon: LucideIcon
  title: string
  amount?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3.5 border-b border-border/70 py-4 transition-colors last:border-b-0",
        "hover:bg-muted/30 -mx-2 rounded-lg px-2",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold tracking-tight text-foreground sm:text-lg">{title}</span>
        {amount ? (
          <span className="mt-0.5 block text-[15px] tabular-nums text-foreground">{amount}</span>
        ) : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
    </Link>
  )
}
