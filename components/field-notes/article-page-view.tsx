import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft } from "lucide-react"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { getFieldNoteCoverSrc } from "@/lib/field-notes-articles"
import { BlogPostCard } from "@/components/field-notes/blog-post-card"
import { ArticleBody } from "@/components/field-notes/article-body"
import { BlogIntrinsicImage } from "@/components/field-notes/blog-intrinsic-image"
import type { BlogListingEmbeds } from "@/lib/services/blogListingEmbeds"

type Props = {
  article: FieldNoteArticle
  relatedArticles: FieldNoteArticle[]
  listingEmbeds: BlogListingEmbeds
}

export function ArticlePageView({ article, relatedArticles, listingEmbeds }: Props) {
  const coverSrc = getFieldNoteCoverSrc(article)
  const dateLine = format(new Date(article.publishedAt), "MMM d, yyyy")

  return (
    <main className="flex-1 bg-background">
      <article>
        <header className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#163060] underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>

          <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.14em] text-[#355185]">
            {article.tag}
          </p>
          <h1 className="mt-3 text-balance font-headline text-[2rem] font-semibold leading-[1.12] tracking-tight text-[#04070E] sm:text-4xl sm:leading-[1.1]">
            {article.title}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {article.author}
            <span aria-hidden> · </span>
            <time dateTime={article.publishedAt}>{dateLine}</time>
            <span aria-hidden> · </span>
            {article.readMinutes} min
          </p>
        </header>

        {coverSrc ? (
          <div className="mx-auto mt-8 max-w-3xl px-4 sm:mt-10 sm:px-6">
            <BlogIntrinsicImage
              src={coverSrc}
              alt={article.title}
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="bg-[#04070E]"
            />
          </div>
        ) : null}

        <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10">
          {article.deck.trim() ? (
            <p className="mb-8 text-[17px] leading-[1.75] text-[#04070E]/80 sm:text-lg sm:leading-[1.8]">
              {article.deck}
            </p>
          ) : null}
          <ArticleBody blocks={article.blocks} listingEmbeds={listingEmbeds} />
          <Link
            href="/blog"
            className="mt-12 inline-flex items-center gap-1.5 text-sm font-medium text-[#163060] underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
        </div>
      </article>

      {relatedArticles.length > 0 ? (
        <section aria-labelledby="article-more-stories" className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 id="article-more-stories" className="font-headline text-lg font-semibold tracking-tight text-[#04070E]">
              More
            </h2>
            <ul className="mt-8 grid list-none gap-x-10 gap-y-12 p-0 sm:grid-cols-2">
              {relatedArticles.map((a) => (
                <li key={a.slug} className="border-t border-border pt-6">
                  <BlogPostCard article={a} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  )
}
