import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { getFieldNoteCoverSrc } from "@/lib/field-notes-articles"
import { BlogListingRow } from "@/components/field-notes/reading-hub"
import { ArticleBody } from "@/components/field-notes/article-body"
import { MostRecentHeading } from "@/components/field-notes/most-recent-heading"
import { BRANDS_BASE } from "@/lib/brands/routes"

type Props = {
  article: FieldNoteArticle
  relatedArticles: FieldNoteArticle[]
}

/**
 * Longform layout inspired by Stab-style article pages: headline stack, kicker line,
 * byline + reading time, full-bleed hero, serif body, “Most recent” rail.
 */
export function ArticlePageView({ article, relatedArticles }: Props) {
  const coverSrc = getFieldNoteCoverSrc(article)
  const dateLine = format(new Date(article.publishedAt), "MMM d, yyyy")
  const kicker = `${article.tag.toLowerCase()} // ${dateLine}`

  return (
    <main className="flex-1 bg-background">
      <article>
        <header className="mx-auto max-w-4xl px-4 pb-2 pt-8 sm:px-6 sm:pt-12 lg:max-w-5xl">
          <Link
            href="/blog"
            className="inline-flex min-h-touch items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Blog
          </Link>

          <h1 className="mt-8 text-balance text-[2rem] font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.05]">
            {article.title}
          </h1>

          <p className="mt-6 max-w-3xl font-sans text-xl font-semibold leading-snug text-foreground sm:text-2xl sm:leading-snug">
            {article.deck}
          </p>

          <p className="mt-8 text-sm leading-normal text-muted-foreground">{kicker}</p>
          <p className="mt-3 text-sm font-medium text-foreground">Words by {article.author}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reading time: {article.readMinutes}{" "}
            {article.readMinutes === 1 ? "minute" : "minutes"}
          </p>
        </header>

        <div className="mx-auto mt-10 w-full max-w-6xl px-0 sm:mt-12 sm:px-6 lg:mt-14">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1152px"
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted" aria-hidden />
          )}
        </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-16 lg:max-w-4xl lg:py-20">
          <ArticleBody blocks={article.blocks} />
        </div>
      </article>

      {relatedArticles.length > 0 ? (
        <section aria-labelledby="article-more-recent" className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:max-w-6xl lg:py-20">
            <MostRecentHeading id="article-more-recent" />
            <ul>
              {relatedArticles.map((a) => (
                <BlogListingRow key={a.slug} article={a} />
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <div className="border-t border-border bg-muted/25">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-14">
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Shop peer-to-peer boards and gear with checkout, messaging, and Purchase Protection.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={BRANDS_BASE}
              className="inline-flex min-h-touch items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Brands
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-touch items-center justify-center rounded-full border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
