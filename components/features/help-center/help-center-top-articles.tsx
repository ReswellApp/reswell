"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { helpCenterTopArticlesByTab } from "@/lib/help-center/top-articles"
import { helpArticlePath } from "@/lib/help-center/paths"
import type { HelpCenterTabId } from "@/lib/help-center/types"

type HelpCenterTopArticlesProps = {
  activeTab: HelpCenterTabId
}

export function HelpCenterTopArticles({ activeTab }: HelpCenterTopArticlesProps) {
  const articles = helpCenterTopArticlesByTab[activeTab]
  const midpoint = Math.ceil(articles.length / 2)
  const leftColumn = articles.slice(0, midpoint)
  const rightColumn = articles.slice(midpoint)

  return (
    <section className="bg-neutral-100 px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-headline text-2xl font-bold text-neutral-900 sm:text-3xl">
          Top articles
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5">
          <ul className="flex flex-col gap-4 sm:gap-5">
            {leftColumn.map((article) => (
              <li key={article.slug}>
                <ArticleLink title={article.title} href={helpArticlePath(article.topicId, article.slug)} />
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-4 sm:gap-5">
            {rightColumn.map((article) => (
              <li key={article.slug}>
                <ArticleLink title={article.title} href={helpArticlePath(article.topicId, article.slug)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ArticleLink({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-md bg-white px-5 py-4 text-left text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
    >
      <span className="text-sm leading-snug sm:text-base">{title}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-900" strokeWidth={1.75} aria-hidden />
    </Link>
  )
}
