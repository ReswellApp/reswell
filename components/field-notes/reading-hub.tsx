import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { Clock } from "lucide-react"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { getFieldNoteCoverSrc } from "@/lib/field-notes-articles"
import { blogImageShouldBypassOptimization } from "@/lib/blog/blog-media-proxy-url"
import { MostRecentHeading } from "@/components/field-notes/most-recent-heading"
import { BlogTitleCover } from "@/components/field-notes/blog-title-cover"

type Props = {
  title: string
  description: string
  articles: FieldNoteArticle[]
  /** Use `div` when nested inside a page that already has `<main>` (e.g. blog index). */
  wrapper?: "main" | "div"
}

export function BlogListingRow({ article }: { article: FieldNoteArticle }) {
  const coverSrc = getFieldNoteCoverSrc(article)
  const dateCaps = format(new Date(article.publishedAt), "MMM d, yyyy").toUpperCase()
  const byline = `BY ${article.author.toUpperCase()} / ${article.tag.toUpperCase()}`

  return (
    <li className="border-t border-border py-10 first:border-t-0 first:pt-0 sm:py-12">
      <Link
        href={`/blog/${article.slug}`}
        className="group grid gap-8 no-underline md:grid-cols-12 md:gap-10 lg:gap-12"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#04070E] md:col-span-5">
          {coverSrc ? (
            <Image
              key={coverSrc}
              src={coverSrc}
              alt={article.title}
              fill
              unoptimized={blogImageShouldBypassOptimization(coverSrc)}
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <BlogTitleCover title={article.title} tag={article.tag} />
          )}
          <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
            <span className="inline-flex items-center gap-2 bg-foreground px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-sm sm:text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
              Reswell
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center md:col-span-7">
          <h3 className="text-2xl font-bold leading-tight tracking-tight text-foreground group-hover:underline sm:text-[1.65rem] sm:leading-snug lg:text-3xl text-balance">
            {article.title}
          </h3>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
            {byline}
          </p>
          <p className="mt-5 text-base leading-relaxed text-foreground/90 sm:text-[17px] sm:leading-[1.65]">
            {article.excerpt}
          </p>
          <div className="mt-8 flex items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 opacity-70" aria-hidden />
              <span>{article.readMinutes} min read</span>
            </span>
            <time dateTime={article.publishedAt}>{dateCaps}</time>
          </div>
        </div>
      </Link>
    </li>
  )
}

export function ReadingHub({ title, description, articles, wrapper = "main" }: Props) {
  const inner = (
    <>
      <div className="border-b border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:max-w-6xl lg:py-20">
          {wrapper === "div" ? (
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          )}
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:max-w-6xl lg:py-20">
        <section aria-labelledby="recent-heading">
          <MostRecentHeading id="recent-heading" />
          {articles.length > 0 ? (
            <ul>
              {articles.map((article) => (
                <BlogListingRow key={article.slug} article={article} />
              ))}
            </ul>
          ) : (
            <p className="py-16 text-center text-muted-foreground">
              Stories are on the way—check back after the next swell.
            </p>
          )}
        </section>

        <footer className="mt-20 border-t border-border pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Ready to browse the marketplace?</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/boards"
                className="inline-flex min-h-touch items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              >
                Browse boards
              </Link>
              <Link
                href="/threads"
                className="inline-flex min-h-touch items-center justify-center rounded-full border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                Threads
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )

  if (wrapper === "div") {
    return <div className="flex-1">{inner}</div>
  }
  return <main className="flex-1">{inner}</main>
}
