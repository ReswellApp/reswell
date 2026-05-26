"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { cn } from "@/lib/utils"
import {
  boardBrowseNavItemIsActive,
  siteHeaderSecondaryNavLinks,
  siteHeaderSecondaryNavItemIsActive,
  surfboardBrowseLinks,
} from "@/lib/site-category-directory"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"

/**
 * Mobile-only horizontal category strip under the header search.
 * Chip shape uses the same full pill rounding as `/boards` filter controls (`rounded-full`).
 */
export function HeaderMobileCategoryBar() {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()

  const chipBase =
    "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-xs font-medium leading-tight text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:border-cerulean/40 focus-visible:ring-2 focus-visible:ring-cerulean/15 focus-visible:ring-offset-0"

  return (
    <nav
      className="-mx-5 border-t border-border bg-background px-5 py-1.5 sm:-mx-6 sm:px-6"
      aria-label="Browse surfboards, sellers, and community"
    >
      <ul className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {surfboardBrowseLinks.map((link) => {
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
  )
}
