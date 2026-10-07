import type { ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ChevronRight,
  Handshake,
  Heart,
  LifeBuoy,
  MessageSquare,
  Package,
  PackageCheck,
  Scale,
  ShoppingBag,
  Store,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react"
import { OverviewSupportDetail } from "@/components/features/dashboard/dashboard-overview-live"
import type { DashboardOverviewModel } from "@/components/features/dashboard/dashboard-overview-model"
import { formatUsd } from "@/lib/utils/format-usd"
import { cn } from "@/lib/utils"

interface DashboardOverviewManageProps {
  model: DashboardOverviewModel
}

interface ManageItem {
  name: string
  href: string
  icon: LucideIcon
  detail: ReactNode
  emphasis?: boolean
}

export function DashboardOverviewManage({ model }: DashboardOverviewManageProps) {
  const items: ManageItem[] = [
    {
      name: "Offers",
      href: "/dashboard/offers?tab=received",
      icon: Handshake,
      emphasis: model.pendingOffers > 0,
      detail: (
        <Detail emphasis={model.pendingOffers > 0}>
          {model.pendingOffers > 0 ? `${model.pendingOffers.toLocaleString()} pending` : "None waiting"}
        </Detail>
      ),
    },
    {
      name: "Messages",
      href: "/messages",
      icon: MessageSquare,
      emphasis: model.unreadCount > 0,
      detail: (
        <Detail emphasis={model.unreadCount > 0}>
          {model.unreadCount > 0 ? `${model.unreadCount.toLocaleString()} unread` : "Caught up"}
        </Detail>
      ),
    },
    {
      name: "Support",
      href: "/dashboard/support",
      icon: LifeBuoy,
      emphasis: model.unreadSupportCount > 0,
      detail: <OverviewSupportDetail initialCount={model.unreadSupportCount} />,
    },
    {
      name: "Sales",
      href: "/dashboard/sales",
      icon: PackageCheck,
      detail: <Detail>{model.sellerOrderCount.toLocaleString()}</Detail>,
    },
    {
      name: "Listings",
      href: "/dashboard/listings",
      icon: Package,
      detail: <Detail>{`${model.activeListings.toLocaleString()} active`}</Detail>,
    },
    {
      name: "Purchases",
      href: "/dashboard/purchases",
      icon: ShoppingBag,
      detail: <Detail>{model.buyerOrderCount.toLocaleString()}</Detail>,
    },
    {
      name: "Earnings",
      href: "/dashboard/earnings",
      icon: Wallet,
      detail: <Detail>{formatUsd(model.walletBalance)}</Detail>,
    },
    {
      name: "Favorites",
      href: "/dashboard/favorites",
      icon: Heart,
      detail: <Detail>{model.favoriteCount.toLocaleString()}</Detail>,
    },
    {
      name: "Followers",
      href: "/dashboard/following?tab=followers",
      icon: Users,
      detail: (
        <Detail>
          <span>{model.followerCount.toLocaleString()}</span>
          {model.newFollowersThisMonth > 0 ? (
            <span className="text-listingHeart">+{model.newFollowersThisMonth.toLocaleString()}</span>
          ) : null}
        </Detail>
      ),
    },
    {
      name: "Following",
      href: "/dashboard/following",
      icon: Users,
      detail: <Detail>{model.followingCount.toLocaleString()}</Detail>,
    },
    {
      name: "Profile",
      href: "/dashboard/profile",
      icon: UserCircle,
      detail: <Detail>Account</Detail>,
    },
  ]

  if (model.shopHref) {
    items.push({
      name: "Shop",
      href: model.shopHref,
      icon: Store,
      detail: <Detail>Public page</Detail>,
    })
  }

  if (model.isAdmin) {
    items.push({
      name: "Balance sheet",
      href: "/dashboard/balance-sheet",
      icon: Scale,
      detail: <Detail>Profit</Detail>,
    })
  }

  const lastSpansRow = items.length % 2 === 1

  return (
    <section className="space-y-4" aria-label="Manage">
      <h2 className="font-headline text-[1.0625rem] font-semibold tracking-tight text-foreground sm:text-lg">
        Manage
      </h2>
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
        {items.map((item, index) => {
          const Icon = item.icon
          const isLast = index === items.length - 1
          return (
            <li key={item.href} className={cn(isLast && lastSpansRow && "md:col-span-2")}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-touch items-center gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  item.emphasis && "bg-listingHeart/[0.05]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  {item.detail}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/70" aria-hidden />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Detail({ children, emphasis = false }: { children: ReactNode; emphasis?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 tabular-nums",
        emphasis ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {emphasis ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-listingHeart" aria-hidden /> : null}
      {children}
    </span>
  )
}
