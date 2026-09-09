"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { filterHelpCenterArticles, getHelpArticleHref } from "@/lib/help-center/registry"
import { cn } from "@/lib/utils"

interface SupportHubSearchProps {
  value: string
  onChange: (value: string) => void
}

export function SupportHubSearch({ value, onChange }: SupportHubSearchProps) {
  const articles = value.trim().length > 0 ? filterHelpCenterArticles(value).slice(0, 6) : []

  return (
    <div className="relative">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="support-hub-search" className="sr-only">
          Search support topics
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="support-hub-search"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          autoComplete="off"
          className={cn(
            "h-12 w-full rounded-full border border-border/80 bg-card pl-11 pr-4 text-[15px] text-foreground shadow-sm",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart",
          )}
        />
      </form>

      {articles.length > 0 ? (
        <ul className="absolute left-0 right-0 z-10 mt-2 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lg">
          {articles.map((article) => (
            <li key={`${article.topicId}-${article.slug}`}>
              <Link
                href={getHelpArticleHref(article)}
                className="block px-4 py-3 text-sm text-foreground transition-colors hover:bg-listingHeart/[0.06]"
              >
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
