"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Store } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DASHBOARD_NAV_LINKS,
  type DashboardNavLink,
} from "@/lib/dashboard-nav-links"

function isLinkActive(pathname: string, href: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  if (href === "/dashboard") {
    return normalized === "/dashboard"
  }
  return normalized === href || normalized.startsWith(`${href}/`)
}

export interface DashboardMobileNavProps {
  sellerProfileHref: string | null
}

export function DashboardMobileNav({ sellerProfileHref }: DashboardMobileNavProps) {
  const pathname = usePathname() ?? ""

  const sellerLink: (DashboardNavLink & { key: string }) | null = sellerProfileHref
    ? {
        key: "seller-profile",
        name: "My Seller Profile",
        href: sellerProfileHref,
        icon: Store,
      }
    : null

  const links: (DashboardNavLink & { key: string })[] = [
    ...DASHBOARD_NAV_LINKS.map((l) => ({ ...l, key: l.href })),
    ...(sellerLink ? [sellerLink] : []),
  ]

  return (
    <nav
      className="lg:hidden -mx-4 border-b border-border px-4 pb-0"
      aria-label="Dashboard sections"
    >
      <ul className="flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => {
          const Icon = link.icon
          const active =
            link.key === "seller-profile"
              ? pathname.replace(/\/$/, "") === link.href.replace(/\/$/, "")
              : isLinkActive(pathname, link.href)
          return (
            <li key={link.key} className="shrink-0">
              <Link
                href={link.href}
                className={cn(
                  "flex min-w-[4.25rem] max-w-[6rem] flex-col items-center gap-1 border-b-2 border-transparent px-1.5 pb-2 pt-1.5 text-center transition-colors",
                  active
                    ? "border-foreground font-bold text-foreground"
                    : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-[11px] leading-tight">{link.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
