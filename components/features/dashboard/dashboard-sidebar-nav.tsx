"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DASHBOARD_NAV_LINKS,
  type DashboardNavLink,
} from "@/lib/dashboard-nav-links"
import {
  dashboardSidebarNavIconClass,
  dashboardSidebarNavItemClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

function isLinkActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const target = href.replace(/\/$/, "") || "/"

  if (target === "/dashboard") {
    return normalized === "/dashboard"
  }

  if (target === "/messages") {
    return normalized === "/messages" || normalized.startsWith("/messages/")
  }

  return normalized === target || normalized.startsWith(`${target}/`)
}

function DashboardNavItem({
  link,
  size,
}: {
  link: DashboardNavLink
  size: "default" | "large"
}) {
  const pathname = usePathname() ?? ""
  const Icon = link.icon
  const isLarge = size === "large"
  const itemClass = isLarge
    ? dashboardSidebarNavItemClass
    : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:gap-3.5 lg:px-4 lg:py-2.5 lg:text-[15px]"
  const iconClass = isLarge
    ? dashboardSidebarNavIconClass
    : "h-4 w-4 lg:h-[18px] lg:w-[18px]"

  if (!link.children?.length) {
    const active = isLinkActive(pathname, link.href)
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
        {link.name}
      </Link>
    )
  }

  const sectionActive = link.children.some((child) => isLinkActive(pathname, child.href))

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
          const childActive = isLinkActive(pathname, child.href)
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
  /** Larger nav for `/dashboard` shell; messages keeps the default compact size. */
  size?: "default" | "large"
}

export function DashboardSidebarNav({
  sellerProfileHref,
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

  return (
    <nav
      className={cn("hidden lg:block", isLarge ? "space-y-2" : "space-y-1.5")}
      aria-label="Dashboard"
    >
      {DASHBOARD_NAV_LINKS.map((link) => (
        <DashboardNavItem key={link.href} link={link} size={size} />
      ))}
      {sellerProfileHref ? (
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
    </nav>
  )
}
