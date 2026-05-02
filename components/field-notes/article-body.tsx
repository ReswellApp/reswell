import Image from "next/image"
import type { ArticleBlock } from "@/lib/field-notes-articles"
import { InstagramEmbedBlock } from "@/components/field-notes/instagram-embed-block"
import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"

function InlineArticleImage({
  url,
  alt,
  caption,
}: {
  url: string
  alt: string
  caption?: string
}) {
  const src = proxiedBlogImageSrc(url)

  /** Same-origin blog storage proxy keeps Supabase hosts out of the DOM. */
  if (src.startsWith("/media/blog/")) {
    return (
      <figure className="space-y-3">
        <span className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted shadow-sm">
          <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 896px" className="object-cover" />
        </span>
        {caption?.trim() ? (
          <figcaption className="text-center text-sm text-muted-foreground">{caption.trim()}</figcaption>
        ) : null}
      </figure>
    )
  }

  try {
    /** Remote CDNs: use `next/image` only where allowed patterns exist. */
    const host = new URL(src).hostname
    const allowOptimized =
      /\.unsplash\.com$/i.test(host) ||
      host === "images.unsplash.com" ||
      host === "picsum.photos"

    const inner = allowOptimized ? (
      <span className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted shadow-sm">
        <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 896px" className="object-cover" />
      </span>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-auto w-full max-w-full rounded-lg border border-border bg-muted shadow-sm"
        loading="lazy"
      />
    )

    return (
      <figure className="space-y-3">
        {inner}
        {caption?.trim() ? (
          <figcaption className="text-center text-sm text-muted-foreground">{caption.trim()}</figcaption>
        ) : null}
      </figure>
    )
  } catch {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Invalid image URL
      </p>
    )
  }
}

export function ArticleBody({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {blocks.map((block, i) => {
        if (block.kind === "h2") {
          return (
            <h2
              key={i}
              className="scroll-mt-28 pt-2 font-sans text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl"
            >
              {block.text}
            </h2>
          )
        }
        if (block.kind === "p") {
          return (
            <p
              key={i}
              className="text-[17px] leading-[1.85] text-foreground/90 sm:text-lg sm:leading-[1.9]"
            >
              {block.text}
            </p>
          )
        }
        if (block.kind === "image") {
          const altLabel = block.alt?.trim() ? block.alt.trim() : "Image for this story"
          return (
            <InlineArticleImage key={i} url={block.url} alt={altLabel} caption={block.caption} />
          )
        }
        return <InstagramEmbedBlock key={i} url={block.url} />
      })}
    </div>
  )
}
