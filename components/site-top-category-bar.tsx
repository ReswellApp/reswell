"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { cn } from "@/lib/utils"
import { isMessageThreadDetailRoute } from "@/lib/utils/message-thread-routes"
import { isSupportCaseThreadRoute } from "@/lib/utils/support-case-paths"
import { HeaderShopperChipItem } from "@/components/header-shopper-category-nav"
import {
  siteHeaderMobileSecondaryNavLinks,
  siteHeaderSecondaryNavItemIsActive,
  siteHeaderShopperNavItems,
} from "@/lib/site-category-directory"
import { isShopifyClaimPath } from "@/lib/shopify/claim-path"

const quietChipBase =
  "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1.5 text-center text-[13px] font-medium leading-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cerulean/15"

/**
 * Marketplace category strip — lives below the site header, separate from account nav.
 * Mobile/tablet: horizontal pill chips. Desktop category links remain in the header bar for now.
 */
export function SiteTopCategoryBar() {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const compact = pathname === "/listyoursurfboard"
  const listingDetail = pathname.startsWith("/l/")

  return (
    <div className="shrink-0 bg-background lg:hidden" data-site-top-category-bar>
      <div
        className={cn(
          "container mx-auto px-4 sm:px-6",
          compact
            ? "py-2 sm:py-2"
            : listingDetail
              ? "pt-3 pb-1.5 sm:pt-3.5 sm:pb-2"
              : "py-3 sm:py-3.5",
        )}
      >
        <nav aria-label="Browse surfboards, sellers, and sold">
          <ul className="flex items-center gap-2.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {siteHeaderShopperNavItems.map((item) => (
              <li key={item.href} className="flex shrink-0 items-center">
                <HeaderShopperChipItem
                  item={item}
                  pathname={pathname}
                  searchParams={searchParams}
                  compact={compact}
                />
              </li>
            ))}
            <li className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
            {siteHeaderMobileSecondaryNavLinks.map((link) => {
              const active = siteHeaderSecondaryNavItemIsActive(pathname, link.href)
              return (
                <li key={link.href} className="flex shrink-0 items-center">
                  <Link
                    href={link.href}
                    className={cn(
                      quietChipBase,
                      compact && "min-h-8 px-2 py-1 text-xs",
                      active && "text-foreground underline decoration-[1.5px] underline-offset-[6px]",
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
  if (isShopifyClaimPath(pathname)) {
    return false
  }
  if (pathname === "/sell" || pathname.startsWith("/sell/")) return false
  if (pathname === "/checkout" || pathname.startsWith("/checkout/")) return false
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false
  // Keep the category slider on the /messages inbox (like other dashboard
  // pages), but hide it inside the full-height conversation thread shell.
  if (isMessageThreadDetailRoute(pathname)) return false
  if (isSupportCaseThreadRoute(pathname)) return false
  return true
}
