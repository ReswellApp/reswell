"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Store } from "lucide-react"
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
  if (href === "/dashboard") {
    return normalized === "/dashboard"
  }
  if (href === "/messages" || href.startsWith("/messages")) {
    return normalized === "/messages" || normalized.startsWith("/messages/")
  }
  return normalized === href || normalized.startsWith(`${href}/`)
}

function isMessageThreadRoute(pathname: string): boolean {
  return /^\/messages\/[^/]+$/.test(pathname) && pathname !== "/messages/offers"
}

function resolveActiveLink(
  pathname: string,
  links: (DashboardNavLink & { key: string })[],
): DashboardNavLink & { key: string } {
  const exactSeller = links.find(
    (link) =>
      link.key === "seller-profile" &&
      pathname.replace(/\/$/, "") === link.href.replace(/\/$/, ""),
  )
  if (exactSeller) return exactSeller

  const active =
    links.find((link) => link.key !== "seller-profile" && isLinkActive(pathname, link.href)) ??
    links[0]

  return active
}

export interface DashboardMobileNavProps {
  sellerProfileHref: string | null
}

export function DashboardMobileNav({ sellerProfileHref }: DashboardMobileNavProps) {
  const pathname = usePathname() ?? ""
  const [open, setOpen] = useState(false)

  const links: (DashboardNavLink & { key: string })[] = useMemo(() => {
    const sellerLink: (DashboardNavLink & { key: string }) | null = sellerProfileHref
      ? {
          key: "seller-profile",
          name: "My Seller Profile",
          href: sellerProfileHref,
          icon: Store,
        }
      : null

    return [
      ...DASHBOARD_NAV_LINKS.map((l) => ({ ...l, key: l.href })),
      ...(sellerLink ? [sellerLink] : []),
    ]
  }, [sellerProfileHref])

  const activeLink = useMemo(() => resolveActiveLink(pathname, links), [links, pathname])

  useEffect(() => {
    if (isMessageThreadRoute(pathname)) {
      setOpen(false)
    }
  }, [pathname])

  return (
    <nav className="lg:hidden" aria-label="Dashboard sections">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-primary/45 bg-card",
            "shadow-[0_4px_18px_rgba(17,17,17,0.08)]",
          )}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-3 bg-background px-4 py-3.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                open && "border-b border-border/50",
              )}
              aria-expanded={open}
            >
              <span className="truncate text-[15px] font-medium text-foreground/90">
                {activeLink.name}
              </span>
              <ChevronDown
                className={cn(
                  "h-[18px] w-[18px] shrink-0 text-muted-foreground/80 transition-transform duration-200",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="overflow-hidden">
            <ul>
              {links.map((link) => {
                const active =
                  link.key === "seller-profile"
                    ? pathname.replace(/\/$/, "") === link.href.replace(/\/$/, "")
                    : isLinkActive(pathname, link.href)

                return (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block px-4 py-3 text-[15px] leading-snug transition-colors",
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {link.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </nav>
  )
}
