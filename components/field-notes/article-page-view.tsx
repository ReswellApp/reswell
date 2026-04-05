import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { ArticleBody } from "@/components/field-notes/article-body"

export function ArticlePageView({ article }: { article: FieldNoteArticle }) {
  const dateLabel = format(new Date(article.publishedAt), "MMMM d, yyyy")

  return (
    <main className="flex-1">
      <article className="border-b border-border/80">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Field notes
          </Link>

          <header className="mt-10 space-y-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="text-foreground">{article.tag}</span>
              <span aria-hidden className="text-border">
                ·
              </span>
              <time dateTime={article.publishedAt}>{dateLabel}</time>
              <span aria-hidden className="text-border">
                ·
              </span>
              <span>{article.readMinutes} min read</span>
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
              {article.title}
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">{article.deck}</p>
            <p className="text-sm text-muted-foreground">By {article.author}</p>
          </header>

          <div className="mt-14 border-t border-border/60 pt-12">
            <ArticleBody blocks={article.blocks} />
          </div>
        </div>
      </article>

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-sm text-muted-foreground">
          <Link href={BRANDS_BASE} className="font-medium text-foreground underline-offset-4 hover:underline">
            Brands
          </Link>
          {" · "}
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Home
          </Link>
        </p>
      </div>
    </main>
  )
}
