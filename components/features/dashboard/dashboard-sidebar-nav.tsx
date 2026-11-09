"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  dashboardNavSections,
  type DashboardNavLink,
} from "@/lib/dashboard-nav-links"
import { isMostSpecificDashboardNavMatch } from "@/lib/dashboard-nav-match"
import {
  dashboardSidebarNavIconClass,
  dashboardSidebarNavItemClass,
} from "@/lib/utils/dashboard-display-styles"
import { SupportUnreadTicker } from "@/components/features/support/support-unread-ticker"
import { cn } from "@/lib/utils"

function navLinkKey(link: DashboardNavLink): string {
  return link.id ?? link.href
}

function DashboardNavItem({
  link,
  size,
  navHrefs,
}: {
  link: DashboardNavLink
  size: "default" | "large"
  navHrefs: readonly string[]
}) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const isActive = (href: string) =>
    isMostSpecificDashboardNavMatch(pathname, href, navHrefs, searchParams)
  const Icon = link.icon
  const isLarge = size === "large"
  const itemClass = isLarge
    ? dashboardSidebarNavItemClass
    : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:gap-3.5 lg:px-4 lg:py-2.5 lg:text-[15px]"
  const iconClass = isLarge
    ? dashboardSidebarNavIconClass
    : "h-4 w-4 lg:h-[18px] lg:w-[18px]"

  if (!link.children?.length) {
    const active = isActive(link.href)
    return (
      <Link
        href={link.href}
        className={cn(
          itemClass,
          active
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className={iconClass} />
        <span className="min-w-0 flex-1 truncate">{link.name}</span>
        {link.href === "/dashboard/support" ? (
          <SupportUnreadTicker className="h-4 min-w-4 text-[10px]" />
        ) : null}
      </Link>
    )
  }

  const sectionActive = link.children.some((child) => isActive(child.href))

  return (
    <Collapsible defaultOpen={sectionActive}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            isLarge
              ? cn(
                  dashboardSidebarNavItemClass,
                  "h-auto w-full justify-between data-[state=open]:[&_.dashboard-nav-chevron]:rotate-180",
                )
              : "flex h-auto w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary lg:px-4 lg:py-2.5 lg:text-[15px] data-[state=open]:[&_.dashboard-nav-chevron]:rotate-180",
            sectionActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            !isLarge && "hover:bg-secondary",
            isLarge && "hover:bg-secondary hover:text-foreground",
          )}
        >
          <span className={cn("flex min-w-0 items-center", isLarge ? "gap-4" : "gap-3 lg:gap-3.5")}>
            <Icon className={iconClass} />
            <span className="truncate">{link.name}</span>
          </span>
          <ChevronDown className="dashboard-nav-chevron h-4 w-4 shrink-0 transition-transform duration-200" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "space-y-0.5 pb-1 pt-0.5",
          isLarge ? "pl-9" : "pl-7",
        )}
      >
        {link.children.map((child) => {
          const childActive = isActive(child.href)
          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                isLarge
                  ? "flex items-center rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors"
                  : "flex items-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors lg:px-4 lg:py-2.5 lg:text-[14px]",
                childActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {child.name}
            </Link>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

export interface DashboardSidebarNavProps {
  sellerProfileHref: string | null
  isAdmin?: boolean
  isShipper?: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess?: boolean
  showEarnings?: boolean
  /** Larger nav for `/dashboard` shell; messages keeps the default compact size. */
  size?: "default" | "large"
}

export function DashboardSidebarNav({
  sellerProfileHref,
  isAdmin = false,
  isShipper = false,
  isDropoffLocation = false,
  hasShopifyAccess = false,
  showEarnings = true,
  size = "default",
}: DashboardSidebarNavProps) {
  const pathname = usePathname() ?? ""
  const isLarge = size === "large"
  const itemClass = isLarge
    ? dashboardSidebarNavItemClass
    : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:gap-3.5 lg:px-4 lg:py-2.5 lg:text-[15px]"
  const iconClass = isLarge
    ? dashboardSidebarNavIconClass
    : "h-4 w-4 lg:h-[18px] lg:w-[18px]"
  const sections = dashboardNavSections({
    isAdmin,
    isShipper,
    isDropoffLocation,
    hasShopifyAccess,
    showEarnings,
  })
  const navHrefs = sections.flatMap((section) =>
    section.links.flatMap((item) => [
      item.href,
      ...(item.children?.map((child) => child.href) ?? []),
    ]),
  )

  return (
    <nav
      className={cn("hidden lg:block", isLarge ? "space-y-6" : "space-y-5")}
      aria-label="Dashboard"
    >
      {sections.map((section) => (
        <div key={section.id} className={cn(isLarge ? "space-y-1.5" : "space-y-1")}>
          <p
            className={cn(
              "px-3 font-semibold tracking-tight text-foreground",
              isLarge ? "px-4 text-[15px]" : "text-sm lg:px-4 lg:text-[15px]",
            )}
          >
            {section.label}
          </p>
          <div className={cn(isLarge ? "space-y-1" : "space-y-0.5")}>
            {section.links.map((link) => (
              <DashboardNavItem
                key={navLinkKey(link)}
                link={link}
                size={size}
                navHrefs={navHrefs}
              />
            ))}
            {section.id === "selling" && sellerProfileHref ? (
              <Link
                href={sellerProfileHref}
                className={cn(
                  itemClass,
                  pathname.replace(/\/$/, "") === sellerProfileHref.replace(/\/$/, "")
                    ? "bg-primary/5 text-primary"
                    : "text-primary hover:bg-primary/5 hover:text-primary",
                )}
              >
                <Store className={iconClass} />
                My Seller Profile
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </nav>
  )
}
