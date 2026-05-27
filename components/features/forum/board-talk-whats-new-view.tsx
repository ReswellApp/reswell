"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, PenLine, Star, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SiteSearchShell, siteSearchInputClassName } from "@/components/site-search-bar"
import { capitalizeWords } from "@/lib/listing-labels"
import type { BoardTalkWhatsNewItem } from "@/lib/services/forumThreads"
import { cn } from "@/lib/utils"

type FilterType = "all" | "threads" | "comments" | "reviews"

type BoardTalkWhatsNewViewProps = {
  items: BoardTalkWhatsNewItem[]
}

function itemMatchesQuery(item: BoardTalkWhatsNewItem, query: string): boolean {
  const haystack =
    item.type === "thread"
      ? `${item.title} ${item.authorName}`
      : item.type === "comment"
        ? `${item.threadTitle} ${item.excerpt} ${item.authorName}`
        : `${item.brandName} ${item.modelName} ${item.excerpt} ${item.authorName}`
  return haystack.toLowerCase().includes(query)
}

export function BoardTalkWhatsNewView({ items }: BoardTalkWhatsNewViewProps) {
  const [filter, setFilter] = useState<FilterType>("all")
  const [query, setQuery] = useState("")

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter === "threads" && item.type !== "thread") return false
      if (filter === "comments" && item.type !== "comment") return false
      if (filter === "reviews" && item.type !== "review") return false
      if (!normalized) return true
      return itemMatchesQuery(item, normalized)
    })
  }, [filter, items, query])

  const filterButtons: { id: FilterType; label: string }[] = [
    { id: "all", label: "All activity" },
    { id: "threads", label: "New posts" },
    { id: "comments", label: "New replies" },
    { id: "reviews", label: "New reviews" },
  ]

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">What&apos;s New</h2>

        <SiteSearchShell actionSlot={null} className="w-full">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity…"
            aria-label="Search what's new"
            className={cn(siteSearchInputClassName(), query && "pr-10")}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </SiteSearchShell>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map((button) => (
            <Button
              key={button.id}
              type="button"
              size="sm"
              variant={filter === button.id ? "default" : "outline"}
              onClick={() => setFilter(button.id)}
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-14 text-center text-muted-foreground sm:px-8">
            <p>{items.length === 0 ? "Nothing new yet — check back after the next swell." : "No activity matches your filters."}</p>
            {items.length > 0 ? (
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => {
                  setQuery("")
                  setFilter("all")
                }}
              >
                Reset filters
              </Button>
            ) : (
              <Button variant="outline" asChild className="mt-6">
                <Link href="/board-talk/new">Start a post</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4 sm:space-y-5">
          {filteredItems.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <Link
                href={
                  item.type === "thread"
                    ? `/board-talk/${item.slug}`
                    : item.type === "comment"
                      ? `/board-talk/${item.threadSlug}#comment-${item.id}`
                      : `/brands/${item.brandSlug}`
                }
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="px-6 py-5 sm:px-8 sm:py-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs font-normal",
                          item.type === "thread" ? "bg-primary/10 text-foreground" : "",
                        )}
                      >
                        {item.type === "thread" ? (
                          <span className="inline-flex items-center gap-1">
                            <PenLine className="h-3 w-3" />
                            New post
                          </span>
                        ) : item.type === "comment" ? (
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            New reply
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            New review
                          </span>
                        )}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.authorName}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-foreground sm:text-xl">
                      {capitalizeWords(
                        item.type === "thread"
                          ? item.title
                          : item.type === "comment"
                            ? item.threadTitle
                            : `${item.brandName} · ${item.modelName}`,
                      )}
                    </h3>
                    {item.type === "comment" || item.type === "review" ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
