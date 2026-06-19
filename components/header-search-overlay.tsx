"use client"

/**
 * Compact search overlay rendered inside the header icon-button Popover.
 * Extracted from header.tsx so it can be dynamic-imported — keeps
 * SearchInputWithSuggest (1 400+ lines) and its deps out of the initial bundle.
 */

import { useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import { clearNavSearchQuery, writeNavSearchQuery } from "@/lib/nav-search-storage"
import { goToCuratedSearchPage } from "@/lib/nav-curated-search"
import {
  headerNavSearchPlaceholder,
  headerNavSearchSubmitHref,
  resolveHeaderNavSearchSection,
} from "@/lib/header-nav-marketplace-search"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { navigateToBrandProfileFromNavPick } from "@/lib/nav-marketplace-brand-search"

function isSearchResultsPath(p: string) {
  return p === "/search" || p === "/search/recent"
}

interface HeaderSearchOverlayProps {
  searchQuery: string
  /** Passed through to SearchInputWithSuggest so the input auto-focuses on open. */
  searchOpen: boolean
  onQueryChange: (q: string) => void
  onClose: () => void
}

export function HeaderSearchOverlay({
  searchQuery,
  searchOpen,
  onQueryChange,
  onClose,
}: HeaderSearchOverlayProps) {
  const router = useRouter()
  const pathname = usePathname()
  const headerSearchParams = useClientSearchParams()
  const navSearchSection = resolveHeaderNavSearchSection(pathname)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const q = searchQuery.trim()
      if (!q) {
        clearNavSearchQuery()
        onQueryChange("")
        onClose()
        await goToCuratedSearchPage(router, pathname, headerSearchParams.toString())
        return
      }
      const href = headerNavSearchSubmitHref(q, pathname, headerSearchParams)
      onQueryChange(q)
      writeNavSearchQuery(q)
      router.push(href)
      onClose()
    },
    [searchQuery, pathname, headerSearchParams, router, onQueryChange, onClose],
  )

  return (
    <SiteSearchBar compact onSubmit={handleSubmit} className="w-full">
      <SearchInputWithSuggest
        value={searchQuery}
        onChange={onQueryChange}
        onBrandStripPick={(brandName, resolved) => {
          if (resolved?.catalogSlug) {
            router.push(`${BRANDS_BASE}/${encodeURIComponent(resolved.catalogSlug)}`)
          } else {
            void navigateToBrandProfileFromNavPick(router, brandName, {
              categorySlug: isSearchResultsPath(pathname ?? "")
                ? headerSearchParams.get("category")
                : null,
              navSubmitted: true,
            })
          }
          onQueryChange("")
          clearNavSearchQuery()
          onClose()
        }}
        onSelect={(text) => {
          const term = text.trim()
          if (!term) return
          onQueryChange(term)
          writeNavSearchQuery(term)
          router.push(headerNavSearchSubmitHref(term, pathname, headerSearchParams))
          onClose()
        }}
        onNavigate={() => {
          onQueryChange("")
          clearNavSearchQuery()
          onClose()
        }}
        placeholder={headerNavSearchPlaceholder(navSearchSection)}
        section={navSearchSection}
        listboxId="nav-search-suggestions-tablet"
        inputClassName={siteSearchInputClassName({ compact: true })}
        className="w-full"
        autoFocus={searchOpen}
        analyticsSurface="header_nav"
        showTextSuggestions={false}
        matchAnchorWidth
      />
    </SiteSearchBar>
  )
}
