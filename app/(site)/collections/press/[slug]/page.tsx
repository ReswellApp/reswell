import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { getPressArticleBySlug, pressArticles, type ContentBlock } from "@/lib/press-articles"

export const revalidate = false

export function generateStaticParams() {
  return pressArticles.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params
  const article = getPressArticleBySlug(slug)
  if (!article) return { title: "Press" }

  return {
    title: `${article.title} · Press`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      images: [{ url: article.heroImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [article.heroImage],
    },
  }
}

function Block({ block }: { block: ContentBlock }) {
  if (block.type === "byline") {
    return (
      <p className="text-sm text-muted-foreground">
        Written by <span className="font-medium text-foreground">{block.writer}</span>
        {block.photographer ? (
          <>
            {" "}· Photographs by <span className="font-medium text-foreground">{block.photographer}</span>
          </>
        ) : null}
      </p>
    )
  }

  if (block.type === "paragraph") {
    return (
      <p className="text-base leading-[1.85] text-foreground/90 sm:text-[1.0625rem]">{block.text}</p>
    )
  }

  if (block.type === "pullquote") {
    return (
      <blockquote className="relative my-2 border-l-[3px] border-primary pl-6 py-1">
        <p className="text-xl font-medium italic leading-snug tracking-tight text-foreground sm:text-2xl text-balance">
          &ldquo;{block.text}&rdquo;
        </p>
        {block.attribution ? (
          <footer className="mt-3 text-sm font-medium text-muted-foreground">— {block.attribution}</footer>
        ) : null}
      </blockquote>
    )
  }

  if (block.type === "heading") {
    return (
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{block.text}</h2>
    )
  }

  if (block.type === "key-facts") {
    return (
      <div className="not-prose rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">At a Glance</p>
        </div>
        <dl className="divide-y divide-border/40">
          {block.facts.map((f) => (
            <div key={f.label} className="flex gap-4 px-5 py-3">
              <dt className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-0.5">
                {f.label}
              </dt>
              <dd className="text-sm text-foreground leading-relaxed">{f.value}</dd>
            </div>
          ))}
        </dl>
        {block.films.length > 0 && (
          <>
            <div className="px-5 py-3 border-t border-border/60 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notable Films</p>
            </div>
            <ul className="divide-y divide-border/40">
              {block.films.map((film) => (
                <li key={film.title} className="flex items-baseline gap-3 px-5 py-3">
                  <span className="text-xs font-medium text-muted-foreground w-10 shrink-0">{film.year}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{film.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{film.significance}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {block.awards.length > 0 && (
          <>
            <div className="px-5 py-3 border-t border-border/60 bg-muted/30">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recognition</p>
            </div>
            <ul className="divide-y divide-border/40">
              {block.awards.map((award) => (
                <li key={award} className="px-5 py-3 text-sm text-foreground">
                  {award}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  if (block.type === "milestone-list") {
    return (
      <ul className="not-prose flex flex-col gap-5">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-4">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xs font-bold">{i + 1}</span>
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-foreground">{item.title}</span>
                <span className="text-xs font-medium text-muted-foreground">{item.period}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (block.type === "photo-grid") {
    const count = block.images.length
    const isSingle = count === 1

    return (
      <div
        className={[
          "not-prose my-2",
          isSingle ? "w-full" : "grid grid-cols-2 gap-3 sm:gap-4",
        ].join(" ")}
      >
        {block.images.map((img, i) => (
          <figure key={i} className="overflow-hidden rounded-xl border border-border/40 bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption ?? ""}
              className="w-full object-contain"
            />
            {img.caption ? (
              <figcaption className="border-t border-border/40 px-4 py-2.5 text-xs leading-snug text-muted-foreground">
                {img.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    )
  }

  return null
}

export default async function PressArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const article = getPressArticleBySlug(slug)
  if (!article) notFound()

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative min-h-[50vh] w-full bg-muted">
        <Image
          src={article.heroImage}
          alt={article.title}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-background/10" />

        <div className="relative mx-auto flex min-h-[50vh] max-w-3xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-32">
          <Link
            href="/collections"
            className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Collections
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Press</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
            {article.title}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            {article.excerpt}
          </p>
        </div>
      </section>

      {/* Article body */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-7">
          {article.content.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        {/* Source attribution */}
        <div className="mt-14 flex items-center justify-between gap-4 border-t border-border/60 pt-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Originally published in</p>
            <p className="mt-0.5 text-base font-semibold text-foreground">{article.sourceLabel}</p>
            <p className="text-sm text-muted-foreground">{article.publishedDate}</p>
          </div>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border/80 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            Read on {article.sourceLabel}
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </a>
        </div>
      </div>
    </main>
  )
}
