"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Search } from "lucide-react"
import { LIVE_CHAT_HELP_LINKS, type LiveChatHelpArticleRef } from "@/lib/live-chat/widget-config"
import { liveChatCardClass } from "@/lib/live-chat/widget-ui"
import { filterHelpCenterArticles, getAllHelpArticles, toHelpArticleLink } from "@/lib/help-center/registry"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface LiveChatHelpViewProps {
  onOpenArticle: (article: LiveChatHelpArticleRef) => void
}

export function LiveChatHelpView({ onOpenArticle }: LiveChatHelpViewProps) {
  const [query, setQuery] = useState("")
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim()
    if (q) {
      return filterHelpCenterArticles(q).map((article) => ({
        ...toHelpArticleLink(article),
        topicId: article.topicId,
      }))
    }
    if (showAll) {
      return getAllHelpArticles().map((article) => ({
        ...toHelpArticleLink(article),
        topicId: article.topicId,
      }))
    }
    return LIVE_CHAT_HELP_LINKS
  }, [query, showAll])

  const searching = query.trim().length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="border-b border-border/50 bg-background px-3 py-3">
        <p className="mb-2.5 px-1 text-xs leading-relaxed text-muted-foreground">
          Quick answers on buying, selling, shipping, and your account.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides"
            className="h-9 border-border/60 bg-muted/30 pl-9 text-sm"
          />
        </div>
      </div>

      <ul className="flex-1 divide-y divide-border/40 overflow-y-auto bg-background">
        {filtered.map((article) => (
          <li key={`${article.topicId}/${article.slug}`}>
            <button
              type="button"
              onClick={() => onOpenArticle({ topicId: article.topicId, slug: article.slug })}
              className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm transition-colors hover:bg-muted/60"
            >
              <span className="line-clamp-2 leading-snug text-foreground/90">{article.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No guides match that search.
          </li>
        ) : null}
      </ul>

      {!searching ? (
        <div className="border-t border-border/50 bg-background px-4 py-3">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className={cn(
              liveChatCardClass,
              "inline-flex w-full items-center justify-center px-3 py-2.5 text-sm font-medium text-listingHeart hover:bg-muted/40",
            )}
          >
            {showAll ? "Show popular guides" : "View all help guides"}
          </button>
        </div>
      ) : null}
    </div>
  )
}
