"use client"

import { useCallback, useEffect, useRef } from "react"
import { ArrowLeft, Info, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HelpScreenshot } from "@/lib/help-center/content-helpers"
import { parseHelpArticlePath } from "@/lib/help-center/paths"
import { getHelpArticle } from "@/lib/help-center/registry"
import type { HelpArticle, HelpCenterTabId } from "@/lib/help-center/types"
import type { LiveChatHelpArticleRef } from "@/lib/live-chat/widget-config"
import { cn } from "@/lib/utils"

interface LiveChatHelpArticleViewProps {
  articleRef: LiveChatHelpArticleRef
  onBack: () => void
  onClose: () => void
  onOpenArticle: (article: LiveChatHelpArticleRef) => void
}

function RelatedArticleButton({
  article,
  onOpen,
}: {
  article: HelpArticle
  onOpen: (article: LiveChatHelpArticleRef) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen({ topicId: article.topicId, slug: article.slug })}
      className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-listingHeart transition-colors hover:bg-listingHeart/5"
    >
      {article.title}
    </button>
  )
}

export function LiveChatHelpArticleView({
  articleRef,
  onBack,
  onClose,
  onOpenArticle,
}: LiveChatHelpArticleViewProps) {
  const article = getHelpArticle(articleRef.topicId, articleRef.slug)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleInArticleNavigation = useCallback(
    (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a")
      if (!(anchor instanceof HTMLAnchorElement)) return

      const href = anchor.getAttribute("href")
      if (!href) return

      const parsed = parseHelpArticlePath(href)
      if (!parsed) return

      event.preventDefault()
      event.stopPropagation()
      onOpenArticle(parsed)
    },
    [onOpenArticle],
  )

  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    root.addEventListener("click", handleInArticleNavigation)
    return () => root.removeEventListener("click", handleInArticleNavigation)
  }, [handleInArticleNavigation, articleRef.topicId, articleRef.slug])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [articleRef.topicId, articleRef.slug])

  if (!article) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <ArticleHeader title="Help guide" onBack={onBack} onClose={onClose} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted-foreground">This guide could not be found.</p>
          <Button type="button" variant="outline" size="sm" onClick={onBack}>
            Back to guides
          </Button>
        </div>
      </div>
    )
  }

  const relatedArticles =
    article.relatedSlugs
      ?.map((slug) => getHelpArticle(article.topicId, slug))
      .filter((related): related is HelpArticle => related != null) ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <ArticleHeader title={article.title} onBack={onBack} onClose={onClose} />

      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {topicLabel(article.topicId)} · {article.sectionTitle}
        </p>
        <h1 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-foreground">
          {article.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{article.description}</p>

        {article.quickAnswer ? (
          <div className="mt-4 rounded-xl border border-listingHeart/20 bg-listingHeart/5 px-3.5 py-3">
            <div className="flex gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-listingHeart" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Quick answer</p>
                <div className="mt-1.5 text-sm leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-listingHeart [&_a]:underline [&_a]:underline-offset-2">
                  {article.quickAnswer}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-6 text-foreground">
          {article.sections.map((section, index) => (
            <section key={index}>
              {section.heading ? (
                <h2 className="mb-2.5 text-base font-semibold text-foreground">{section.heading}</h2>
              ) : null}
              <div
                className={cn(
                  "text-sm leading-relaxed text-foreground/90",
                  "[&_a]:font-medium [&_a]:text-listingHeart [&_a]:underline [&_a]:underline-offset-2",
                  "[&_li]:leading-relaxed [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-4",
                  "[&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-4",
                  "[&_img]:rounded-lg",
                  "[&_figure]:mt-3 [&_figure]:rounded-lg [&_figure]:border [&_figure]:border-border/50",
                  "[&_figcaption]:px-3 [&_figcaption]:py-2 [&_figcaption]:text-xs [&_figcaption]:text-muted-foreground",
                )}
              >
                {section.body}
              </div>
              {section.figure ? (
                <div className="mt-3 [&_figure]:mt-0 [&_figcaption]:text-xs">
                  <HelpScreenshot {...section.figure} />
                </div>
              ) : null}
            </section>
          ))}
        </div>

        {relatedArticles.length > 0 ? (
          <section className="mt-8 border-t border-border/50 pt-5 pb-2">
            <h2 className="text-sm font-semibold text-foreground">Related guides</h2>
            <ul className="mt-2 divide-y divide-border/40">
              {relatedArticles.map((related) => (
                <li key={`${related.topicId}/${related.slug}`}>
                  <RelatedArticleButton article={related} onOpen={onOpenArticle} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="pb-2" />
        )}
      </div>
    </div>
  )
}

function ArticleHeader({
  title,
  onBack,
  onClose,
}: {
  title: string
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border/50 bg-background px-2 py-2.5">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</p>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close">
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

function topicLabel(topicId: HelpCenterTabId): string {
  if (topicId === "buying") return "Buying"
  if (topicId === "selling") return "Selling"
  return "Accounts"
}
