import Link from "next/link"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { BlogPostCard } from "@/components/field-notes/blog-post-card"

type Props = {
  title: string
  description: string
  articles: FieldNoteArticle[]
  /** Use `div` when nested inside a page that already has `<main>` (e.g. blog index). */
  wrapper?: "main" | "div"
}

export function ReadingHub({ title, description, articles, wrapper = "main" }: Props) {
  const heading =
    wrapper === "div" ? (
      <h2 className="font-headline text-3xl font-semibold tracking-tight text-[#04070E] sm:text-4xl">{title}</h2>
    ) : (
      <h1 className="font-headline text-3xl font-semibold tracking-tight text-[#04070E] sm:text-4xl">{title}</h1>
    )

  const inner = (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-xl">
        {heading}
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>
      </header>

      {articles.length > 0 ? (
        <ul className="mt-12 grid list-none gap-x-10 gap-y-14 p-0 sm:grid-cols-2">
          {articles.map((article) => (
            <li key={article.slug} className="border-t border-border pt-6">
              <BlogPostCard article={article} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-16 text-muted-foreground">Nothing published yet.</p>
      )}

      <footer className="mt-16 border-t border-border pt-8">
        <Link
          href="/boards"
          className="text-sm font-medium text-[#163060] underline-offset-4 hover:underline"
        >
          Shop boards
        </Link>
      </footer>
    </div>
  )

  if (wrapper === "div") {
    return <div className="flex-1">{inner}</div>
  }
  return <main className="flex-1">{inner}</main>
}
