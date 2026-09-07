import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import type { FieldNoteArticle } from "@/lib/field-notes-articles"
import { getFieldNoteCoverSrc } from "@/lib/field-notes-articles"
import { blogImageShouldBypassOptimization } from "@/lib/blog/blog-media-proxy-url"

export function BlogPostCard({ article }: { article: FieldNoteArticle }) {
  const coverSrc = getFieldNoteCoverSrc(article)
  const dateLine = format(new Date(article.publishedAt), "MMM d, yyyy")

  return (
    <article>
      <Link href={`/blog/${article.slug}`} className="group block no-underline">
        {coverSrc ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-[#04070E]">
            <Image
              key={coverSrc}
              src={coverSrc}
              alt=""
              fill
              unoptimized={blogImageShouldBypassOptimization(coverSrc)}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-opacity duration-300 group-hover:opacity-90"
            />
          </div>
        ) : null}
        <p className={coverSrc ? "mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#355185]" : "text-[11px] font-medium uppercase tracking-[0.14em] text-[#355185]"}>
          {article.tag}
        </p>
        <h3 className="mt-2 text-balance font-headline text-xl font-semibold leading-snug tracking-tight text-[#04070E] group-hover:text-[#163060] sm:text-[1.35rem]">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted-foreground">
          {article.excerpt}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{dateLine}</p>
      </Link>
    </article>
  )
}
