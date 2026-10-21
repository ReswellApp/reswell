"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, Store } from "lucide-react"
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
import { SupportUnreadTicker } from "@/components/features/support/support-unread-ticker"
import { cn } from "@/lib/utils"

function isMessageThreadRoute(pathname: string): boolean {
  return /^\/messages\/[^/]+$/.test(pathname) && pathname !== "/messages/offers"
}

function navLinkKey(link: DashboardNavLink & { key?: string }): string {
  return link.key ?? link.id ?? link.href
}

function resolveActiveLink(
  pathname: string,
  links: (DashboardNavLink & { key: string })[],
  searchParams: { get(name: string): string | null },
): DashboardNavLink & { key: string } {
  const exactSeller = links.find(
    (link) =>
      link.key === "seller-profile" &&
      pathname.replace(/\/$/, "") === link.href.replace(/\/$/, ""),
  )
  if (exactSeller) return exactSeller

  const hrefs = links.map((link) => link.href)
  const active =
    links.find(
      (link) =>
        link.key !== "seller-profile" &&
        isMostSpecificDashboardNavMatch(pathname, link.href, hrefs, searchParams),
    ) ?? links[0]

  return active
}

export interface DashboardMobileNavProps {
  sellerProfileHref: string | null
  isAdmin?: boolean
  isShipper?: boolean
  isDropoffLocation?: boolean
  hasShopifyAccess?: boolean
  showEarnings?: boolean
  /** Pango-style bordered bar for account pages (e.g. /messages). */
  variant?: "default" | "account"
}

export function DashboardMobileNav({
  sellerProfileHref,
  isAdmin = false,
  isShipper = false,
  isDropoffLocation = false,
  hasShopifyAccess = false,
  showEarnings = true,
  variant = "default",
}: DashboardMobileNavProps) {
  const isAccountVariant = variant === "account"
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  const sections = useMemo(
    () =>
      dashboardNavSections({
        isAdmin,
        isShipper,
        isDropoffLocation,
        hasShopifyAccess,
        showEarnings,
      }),
    [hasShopifyAccess, isAdmin, isDropoffLocation, isShipper, showEarnings],
  )

  const links: (DashboardNavLink & { key: string })[] = useMemo(() => {
    const flat = sections.flatMap((section) =>
      section.links.map((l) => ({
        ...l,
        key: navLinkKey(l),
      })),
    )

    if (!sellerProfileHref) return flat

    const sellerLink: DashboardNavLink & { key: string } = {
      key: "seller-profile",
      name: "My Seller Profile",
      href: sellerProfileHref,
      icon: Store,
    }

    // Keep seller profile with Selling items for mobile active-label resolution order.
    const sellingCount = sections.find((s) => s.id === "selling")?.links.length ?? 0
    return [...flat.slice(0, sellingCount), sellerLink, ...flat.slice(sellingCount)]
  }, [sections, sellerProfileHref])

  const navHrefs = useMemo(() => links.map((link) => link.href), [links])
  const activeLink = useMemo(
    () => resolveActiveLink(pathname, links, searchParams),
    [links, pathname, searchParams],
  )

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
            "overflow-hidden bg-background",
            isAccountVariant
              ? "rounded-lg border border-border"
              : "rounded-xl border border-primary/45 bg-card shadow-[0_4px_18px_rgba(17,17,17,0.08)]",
          )}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isAccountVariant ? "py-3" : "bg-background py-3.5",
                open && "border-b border-border/50",
              )}
              aria-expanded={open}
            >
              <span
                className={cn(
                  "flex min-w-0 items-center gap-2 truncate text-[15px] text-foreground",
                  isAccountVariant ? "font-semibold" : "font-medium text-foreground/90",
                )}
              >
                <span className="truncate">{activeLink.name}</span>
                {activeLink.href === "/dashboard/support" ? (
                  <SupportUnreadTicker className="h-4 min-w-4 text-[10px]" />
                ) : null}
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
            <div className="pb-1">
              {sections.map((section) => (
                <div key={section.id} className="pt-2">
                  <p className="px-4 pb-1 text-[13px] font-semibold text-foreground">
                    {section.label}
                  </p>
                  <ul>
                    {section.links.map((link) => {
                      const active = isMostSpecificDashboardNavMatch(
                        pathname,
                        link.href,
                        navHrefs,
                        searchParams,
                      )
                      const key = navLinkKey(link)

                      return (
                        <li key={key}>
                          <Link
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center justify-between gap-3 px-4 py-2.5 text-[15px] leading-snug transition-colors",
                              active
                                ? "bg-primary/10 font-semibold text-primary"
                                : "font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                            )}
                            aria-current={active ? "page" : undefined}
                          >
                            <span>{link.name}</span>
                            {link.href === "/dashboard/support" ? (
                              <SupportUnreadTicker className="h-4 min-w-4 text-[10px]" />
                            ) : null}
                          </Link>
                        </li>
                      )
                    })}
                    {section.id === "selling" && sellerProfileHref ? (
                      <li>
                        <Link
                          href={sellerProfileHref}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-3 px-4 py-2.5 text-[15px] leading-snug transition-colors",
                            pathname.replace(/\/$/, "") ===
                              sellerProfileHref.replace(/\/$/, "")
                              ? "bg-primary/10 font-semibold text-primary"
                              : "font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                          )}
                          aria-current={
                            pathname.replace(/\/$/, "") ===
                            sellerProfileHref.replace(/\/$/, "")
                              ? "page"
                              : undefined
                          }
                        >
                          <span>My Seller Profile</span>
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </nav>
  )
}
