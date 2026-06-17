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

function DashboardNavItem({ link }: { link: DashboardNavLink }) {
  const pathname = usePathname() ?? ""
  const Icon = link.icon

  if (!link.children?.length) {
    const active = isLinkActive(pathname, link.href)
    return (
      <Link
        href={link.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:gap-3.5 lg:px-4 lg:py-2.5 lg:text-[15px]",
          active
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
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
            "flex h-auto w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary lg:px-4 lg:py-2.5 lg:text-[15px] data-[state=open]:[&_.dashboard-nav-chevron]:rotate-180",
            sectionActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="flex min-w-0 items-center gap-3 lg:gap-3.5">
            <Icon className="h-4 w-4 shrink-0 lg:h-[18px] lg:w-[18px]" />
            <span className="truncate">{link.name}</span>
          </span>
          <ChevronDown className="dashboard-nav-chevron h-4 w-4 shrink-0 transition-transform duration-200" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pb-1 pl-7 pt-0.5">
        {link.children.map((child) => {
          const childActive = isLinkActive(pathname, child.href)
          return (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors lg:px-4 lg:py-2.5 lg:text-[14px]",
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
}

export function DashboardSidebarNav({ sellerProfileHref }: DashboardSidebarNavProps) {
  const pathname = usePathname() ?? ""

  return (
    <nav className="hidden space-y-1.5 lg:block" aria-label="Dashboard">
      {DASHBOARD_NAV_LINKS.map((link) => (
        <DashboardNavItem key={link.href} link={link} />
      ))}
      {sellerProfileHref ? (
        <Link
          href={sellerProfileHref}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:gap-3.5 lg:px-4 lg:py-2.5 lg:text-[15px]",
            pathname.replace(/\/$/, "") === sellerProfileHref.replace(/\/$/, "")
              ? "bg-primary/5 text-primary"
              : "text-primary hover:bg-primary/5 hover:text-primary",
          )}
        >
          <Store className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
          My Seller Profile
        </Link>
      ) : null}
    </nav>
  )
}
