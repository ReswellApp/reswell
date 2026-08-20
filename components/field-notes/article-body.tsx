import Image from "next/image"
import type { ArticleBlock } from "@/lib/field-notes-articles"
import { InstagramEmbedBlock } from "@/components/field-notes/instagram-embed-block"
import { BlogIntrinsicImage } from "@/components/field-notes/blog-intrinsic-image"
import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"

function InlineArticleImage({
  url,
  alt,
  caption,
  width,
  height,
}: {
  url: string
  alt: string
  caption?: string
  width?: number
  height?: number
}) {
  const src = proxiedBlogImageSrc(url)

  return (
    <figure className="space-y-3">
      <BlogIntrinsicImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 896px"
        className="rounded-lg bg-muted shadow-sm"
      />
      {caption?.trim() ? (
        <figcaption className="text-center text-sm text-muted-foreground">{caption.trim()}</figcaption>
      ) : null}
    </figure>
  )
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
              className="whitespace-pre-wrap text-[17px] leading-[1.85] text-foreground/90 sm:text-lg sm:leading-[1.9]"
            >
              {block.text}
            </p>
          )
        }
        if (block.kind === "image") {
          const altLabel = block.alt?.trim() ? block.alt.trim() : "Image for this story"
          return (
            <InlineArticleImage
              key={i}
              url={block.url}
              alt={altLabel}
              caption={block.caption}
              width={block.width}
              height={block.height}
            />
          )
        }
        return <InstagramEmbedBlock key={i} url={block.url} />
      })}
    </div>
  )
}
