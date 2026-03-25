import Link from "next/link"
import { format } from "date-fns"
import { ArrowUpRight } from "lucide-react"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  description: string
  articles: FieldNoteArticle[]
  /** Use `div` when nested inside a page that already has `<main>` (e.g. Index). */
  wrapper?: "main" | "div"
}

function ArticleMeta({ article, className }: { article: FieldNoteArticle; className?: string }) {
  const dateLabel = format(new Date(article.publishedAt), "MMM d, yyyy")
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground", className)}>
      <span className="font-medium uppercase tracking-wider text-foreground/80">{article.tag}</span>
      <span aria-hidden className="text-border">
        ·
      </span>
      <time dateTime={article.publishedAt}>{dateLabel}</time>
      <span aria-hidden className="text-border">
        ·
      </span>
      <span>{article.readMinutes} min</span>
    </div>
  )
}

export function ReadingHub({ title, description, articles, wrapper = "main" }: Props) {
  const [featured, ...rest] = articles

  const inner = (
    <>
      <div className="border-b border-border/80 bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
          {wrapper === "div" ? (
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">{title}</h2>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">{title}</h1>
          )}
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        {featured ? (
          <section aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="sr-only">
              Featured article
            </h2>
            <Link
              href={`/blog/${featured.slug}`}
              className="group block rounded-lg border border-border/80 bg-card p-6 shadow-soft transition-all hover:border-foreground/20 hover:shadow-soft-hover sm:p-8"
            >
              <ArticleMeta article={featured} className="mb-4" />
              <h3 className="text-xl font-semibold tracking-tight text-foreground group-hover:underline sm:text-2xl text-balance">
                {featured.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{featured.excerpt}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                Read article
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section className={cn(featured ? "mt-16" : "", "border-t border-border/60 pt-12")} aria-labelledby="more-heading">
            <h2 id="more-heading" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              More to read
            </h2>
            <ul className="mt-8 divide-y divide-border/80 border-y border-border/80">
              {rest.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="group flex flex-col gap-3 py-8 first:pt-6 last:pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <ArticleMeta article={article} />
                      <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:underline sm:text-xl text-balance">
                        {article.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{article.excerpt}</p>
                    </div>
                    <ArrowUpRight
                      className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground sm:mt-1"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!featured && rest.length === 0 ? (
          <p className="text-center text-muted-foreground">Articles will appear here soon.</p>
        ) : null}

        <footer className="mt-16 border-t border-border/60 pt-10">
          <p className="text-sm text-muted-foreground">
            Looking for gear?{" "}
            <Link href="/used" className="font-medium text-foreground underline-offset-4 hover:underline">
              Browse used
            </Link>
            {" · "}
            <Link href="/board-talk" className="font-medium text-foreground underline-offset-4 hover:underline">
              Board Talk
            </Link>
          </p>
        </footer>
      </div>
    </>
  )

  if (wrapper === "div") {
    return <div className="flex-1">{inner}</div>
  }
  return <main className="flex-1">{inner}</main>
}
