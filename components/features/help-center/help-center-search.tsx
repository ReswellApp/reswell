"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { filterHelpCenterArticles, getHelpArticleHref } from "@/lib/help-center/registry"
import { cn } from "@/lib/utils"

type HelpCenterSearchProps = {
  className?: string
  inputId?: string
  compact?: boolean
}

export function HelpCenterSearch({
  className,
  inputId = "help-center-search",
  compact = false,
}: HelpCenterSearchProps) {
  const [query, setQuery] = useState("")
  const searchResults = useMemo(() => filterHelpCenterArticles(query), [query])
  const showSearchResults = query.trim().length > 0

  return (
    <div className={cn(compact ? "w-full" : "mx-auto w-full max-w-2xl", className)}>
      <form className="relative" onSubmit={(e) => e.preventDefault()} role="search">
        <label htmlFor={inputId} className="sr-only">
          Search Help Center
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Help Center"
          className={cn(
            "w-full rounded-full border border-neutral-300 bg-white text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900",
            compact ? "py-3 pl-5 pr-14 text-sm" : "py-3.5 pl-5 pr-14 text-base",
          )}
          autoComplete="off"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-listingHeart text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2"
          aria-label="Search"
        >
          <Search className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </button>
      </form>

      {showSearchResults ? (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded-lg border border-neutral-200 bg-white text-left shadow-lg">
          {searchResults.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-600">No articles matched your search.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
              {searchResults.map((article) => (
                <li key={`${article.topicId}-${article.slug}`}>
                  <Link
                    href={getHelpArticleHref(article)}
                    className="block px-4 py-3.5 text-sm text-neutral-900 transition-colors hover:bg-neutral-50"
                    onClick={() => setQuery("")}
                  >
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
