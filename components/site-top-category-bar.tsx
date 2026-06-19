"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { cn } from "@/lib/utils"
import { isMessageThreadDetailRoute } from "@/lib/utils/message-thread-routes"
import {
  boardBrowseNavItemIsActive,
  siteHeaderMainCategoryNavLinks,
  siteHeaderSecondaryNavLinks,
  siteHeaderSecondaryNavItemIsActive,
} from "@/lib/site-category-directory"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"

const chipBase =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-center text-[13px] font-semibold leading-tight text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:border-cerulean/40 focus-visible:ring-2 focus-visible:ring-cerulean/15 focus-visible:ring-offset-0"

/**
 * Marketplace category strip — lives below the site header, separate from account nav.
 * Mobile/tablet: horizontal pill chips. Desktop category links remain in the header bar for now.
 */
export function SiteTopCategoryBar() {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()

  return (
    <div className="shrink-0 bg-background lg:hidden">
      <div className="container mx-auto px-4 py-3 sm:px-6 sm:py-3.5">
        <nav aria-label="Browse surfboards, sellers, and community">
          <ul className="flex items-center gap-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {siteHeaderMainCategoryNavLinks.map((link) => {
              const active = boardBrowseNavItemIsActive(pathname, searchParams, link.href)
              return (
                <li key={link.href} className="flex shrink-0 items-center">
                  <Link
                    href={link.href}
                    prefetch={boardsBrowseLinkPrefetch(link.href)}
                    className={cn(
                      chipBase,
                      active
                        ? "border-foreground bg-muted font-semibold"
                        : "border-border bg-background hover:border-midgray/35",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
            {siteHeaderSecondaryNavLinks.map((link) => {
              const active = siteHeaderSecondaryNavItemIsActive(pathname, link.href)
              return (
                <li key={link.href} className="flex shrink-0 items-center">
                  <Link
                    href={link.href}
                    className={cn(
                      chipBase,
                      active
                        ? "border-foreground bg-muted font-semibold"
                        : "border-border bg-background hover:border-midgray/35",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}

export function shouldShowSiteTopCategoryBar(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname.startsWith("/auth") || pathname === "/help" || pathname.startsWith("/help/")) {
    return false
  }
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return false
  if (pathname === "/checkout" || pathname.startsWith("/checkout/")) return false
  // Keep the category slider on the /messages inbox (like other dashboard
  // pages), but hide it inside the full-height conversation thread shell.
  if (isMessageThreadDetailRoute(pathname)) return false
  return true
}
