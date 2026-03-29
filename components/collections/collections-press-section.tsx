import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import { pressArticles } from "@/lib/press-articles"

export function CollectionsPressSection() {
  if (pressArticles.length === 0) return null

  return (
    <section className="mt-16 sm:mt-20 lg:mt-24">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Press</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Collections in the Wild
        </h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pressArticles.map((article) => (
          <Link
            key={article.slug}
            href={`/collections/press/${article.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative min-h-[200px] flex-1 bg-muted">
              <Image
                src={article.heroImage}
                alt={article.title}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl group-hover:underline decoration-primary/40 underline-offset-4">
                    {article.title}
                  </h3>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-border/60 opacity-90 transition group-hover:opacity-100">
                    <ArrowUpRight className="h-5 w-5" aria-hidden />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 bg-card px-5 py-4">
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{article.excerpt}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">{article.sourceLabel}</p>
                <p className="text-xs text-muted-foreground">{article.publishedDate}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
