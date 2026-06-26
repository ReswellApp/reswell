"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink, Store } from "lucide-react"
import type { ConsignmentStoreStaffRole } from "@/lib/types/consignment"
import {
  buildStoreNavSections,
  filterStoreNavSections,
  storeNavHref,
  type StoreNavLink,
} from "@/lib/store-nav-links"
import {
  dashboardSidebarNavIconClass,
  dashboardSidebarNavItemClass,
} from "@/lib/utils/dashboard-display-styles"
import { cn } from "@/lib/utils"

function isStoreLinkActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const target = href.replace(/\/$/, "") || "/"

  if (target.endsWith("/dashboard") || target.endsWith("/account")) {
    return normalized === target
  }

  if (target.endsWith("/messages") || target.endsWith("/account/messages")) {
    return normalized === target || normalized.startsWith(`${target}/`)
  }

  return normalized === target || normalized.startsWith(`${target}/`)
}

function StoreNavItem({ link, slug, pathname }: { link: StoreNavLink; slug: string; pathname: string }) {
  const href = storeNavHref(slug, link.path)
  const active = isStoreLinkActive(pathname, href)
  const Icon = link.icon

  return (
    <Link
      href={href}
      className={cn(
        dashboardSidebarNavItemClass,
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className={dashboardSidebarNavIconClass} />
      {link.name}
    </Link>
  )
}

export interface StoreSidebarNavProps {
  slug: string
  storeName: string
  role: ConsignmentStoreStaffRole
  sellerProfileHref: string | null
}

export function StoreSidebarNav({
  slug,
  storeName,
  role,
  sellerProfileHref,
}: StoreSidebarNavProps) {
  const pathname = usePathname() ?? ""
  const sections = filterStoreNavSections(buildStoreNavSections(), role)

  return (
    <nav className="hidden lg:block space-y-6" aria-label="Consignment store">
      <div className="rounded-xl border bg-card px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Consignment shop
        </p>
        <p className="mt-1 truncate text-base font-semibold text-foreground">{storeName}</p>
        <p className="mt-0.5 text-xs capitalize text-muted-foreground">{role}</p>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <StoreNavItem key={item.path} link={item} slug={slug} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1 border-t pt-4">
        {sellerProfileHref ? (
          <Link
            href={sellerProfileHref}
            target="_blank"
            className={cn(
              dashboardSidebarNavItemClass,
              "text-primary hover:bg-primary/5 hover:text-primary",
            )}
          >
            <ExternalLink className={dashboardSidebarNavIconClass} />
            Public shop profile
          </Link>
        ) : (
          <Link
            href={`/stores/${slug}/consign`}
            className={cn(
              dashboardSidebarNavItemClass,
              "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Store className={dashboardSidebarNavIconClass} />
            Consignor intake page
          </Link>
        )}
      </div>
    </nav>
  )
}
