import type { ArticleBlock } from "@/lib/field-notes-articles"
import { InstagramEmbedBlock } from "@/components/field-notes/instagram-embed-block"
import { BlogIntrinsicImage } from "@/components/field-notes/blog-intrinsic-image"
import { BlogListingTile } from "@/components/field-notes/blog-listing-tile"
import { BlogListingImages } from "@/components/field-notes/blog-listing-images"
import { BlogSoldListings } from "@/components/field-notes/blog-sold-listings"
import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"
import {
  listingForBlogBlockRef,
  type BlogListingEmbeds,
} from "@/lib/services/blogListingEmbeds"
import { cn } from "@/lib/utils"

const CALLOUT_RE =
  /^(why it stands out|best for|key strengths|possible limitations):\s*/i

type ParagraphBlock = Extract<ArticleBlock, { kind: "p" }>
type ImageBlock = Extract<ArticleBlock, { kind: "image" }>
type HeadingBlock = Extract<ArticleBlock, { kind: "h2" }>

type ListingBlock = Extract<ArticleBlock, { kind: "listing" }>
type ListingImageBlock = Extract<ArticleBlock, { kind: "listing-image" }>
type SoldListingsBlock = Extract<ArticleBlock, { kind: "sold-listings" }>

type BodyGroup =
  | { kind: "p"; block: ParagraphBlock }
  | { kind: "image"; block: ImageBlock }
  | { kind: "instagram"; url: string }
  | { kind: "listing"; block: ListingBlock }
  | { kind: "listing-image"; block: ListingImageBlock }
  | { kind: "sold-listings"; block: SoldListingsBlock }
  | { kind: "section"; heading: HeadingBlock; paragraphs: ParagraphBlock[]; image?: ImageBlock }

function groupBlocks(blocks: ArticleBlock[]): BodyGroup[] {
  const groups: BodyGroup[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.kind === "h2") {
      const paragraphs: ParagraphBlock[] = []
      i += 1
      while (i < blocks.length && blocks[i].kind === "p") {
        paragraphs.push(blocks[i] as ParagraphBlock)
        i += 1
      }
      const image = blocks[i]?.kind === "image" ? (blocks[i] as ImageBlock) : undefined
      if (image) i += 1
      groups.push({ kind: "section", heading: block, paragraphs, image })
      continue
    }
    if (block.kind === "p") groups.push({ kind: "p", block })
    else if (block.kind === "image") groups.push({ kind: "image", block })
    else if (block.kind === "instagram") groups.push({ kind: "instagram", url: block.url })
    else if (block.kind === "listing") groups.push({ kind: "listing", block })
    else if (block.kind === "listing-image") groups.push({ kind: "listing-image", block })
    else if (block.kind === "sold-listings") groups.push({ kind: "sold-listings", block })
    i += 1
  }
  return groups
}

function ParagraphText({
  text,
  isLead,
  className,
}: {
  text: string
  isLead?: boolean
  className?: string
}) {
  const callout = CALLOUT_RE.exec(text.trim())
  if (callout) {
    const body = text.trim().slice(callout[0].length).trim()
    const label = callout[1].replace(/\b\w/g, (c) => c.toUpperCase())
    return (
      <p className={cn("mt-4 text-[16.5px] leading-[1.75] text-foreground/90 sm:text-[17px]", className)}>
        <span className="font-semibold text-foreground">{label}:</span> {body}
      </p>
    )
  }

  return (
    <p
      className={cn(
        "mt-4 whitespace-pre-wrap text-foreground/90 first:mt-0",
        isLead
          ? "text-[17px] leading-[1.75] sm:text-lg sm:leading-[1.8]"
          : "text-[16.5px] leading-[1.75] sm:text-[17px] sm:leading-[1.8]",
        className,
      )}
    >
      {text}
    </p>
  )
}

function GuideImage({ block, compact }: { block: ImageBlock; compact?: boolean }) {
  const altLabel = block.alt?.trim() ? block.alt.trim() : "Image for this story"
  return (
    <figure className={cn(compact ? "space-y-2" : "mt-8 space-y-2")}>
      <BlogIntrinsicImage
        src={proxiedBlogImageSrc(block.url)}
        alt={altLabel}
        width={block.width}
        height={block.height}
        sizes={compact ? "(max-width: 768px) 100vw, 280px" : "(max-width: 768px) 100vw, 672px"}
        className="bg-[#04070E]"
      />
      {block.caption?.trim() ? (
        <figcaption className="text-sm leading-relaxed text-muted-foreground">{block.caption.trim()}</figcaption>
      ) : null}
    </figure>
  )
}

function SectionHeading({ text }: { text: string }) {
  const numbered = /^(\d+)\.\s+(.+)$/.exec(text.trim())
  const isQuestion = text.trim().endsWith("?")
  const label = numbered ? `${numbered[1]}. ${numbered[2]}` : text

  return (
    <h2
      className={cn(
        "scroll-mt-28 font-headline tracking-tight text-[#163060]",
        isQuestion ? "text-lg font-semibold leading-snug sm:text-xl" : "text-xl font-semibold leading-snug sm:text-2xl",
      )}
    >
      {label}
    </h2>
  )
}

export function ArticleBody({
  blocks,
  listingEmbeds,
}: {
  blocks: ArticleBlock[]
  listingEmbeds: BlogListingEmbeds
}) {
  const groups = groupBlocks(blocks)
  let leadUsed = false

  return (
    <div>
      {groups.map((group, i) => {
        if (group.kind === "p") {
          const isLead = !leadUsed
          leadUsed = true
          return <ParagraphText key={i} text={group.block.text} isLead={isLead} />
        }
        if (group.kind === "image") {
          return <GuideImage key={i} block={group.block} />
        }
        if (group.kind === "instagram") {
          return (
            <div key={i} className="mt-10">
              <InstagramEmbedBlock url={group.url} />
            </div>
          )
        }
        if (group.kind === "listing") {
          const listing = listingForBlogBlockRef(listingEmbeds, group.block.ref)
          return listing ? <BlogListingTile key={i} listing={listing} /> : null
        }
        if (group.kind === "listing-image") {
          const listing = listingForBlogBlockRef(listingEmbeds, group.block.ref)
          return listing ? (
            <BlogListingImages key={i} listing={listing} caption={group.block.caption} />
          ) : null
        }
        if (group.kind === "sold-listings") {
          const count = group.block.limit ?? 6
          return <BlogSoldListings key={i} listings={listingEmbeds.soldListings.slice(0, count)} />
        }

        const body = (
          <>
            <SectionHeading text={group.heading.text} />
            {group.paragraphs.map((paragraph, pi) => (
              <ParagraphText key={pi} text={paragraph.text} />
            ))}
          </>
        )

        if (!group.image) {
          return (
            <section key={i} className={cn(i === 0 ? "mt-0" : "mt-10 sm:mt-12")}>
              {body}
            </section>
          )
        }

        return (
          <section
            key={i}
            className={cn(
              "grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_240px] md:gap-10",
              i === 0 ? "mt-0" : "mt-10 sm:mt-12",
            )}
          >
            <div>{body}</div>
            <GuideImage block={group.image} compact />
          </section>
        )
      })}
    </div>
  )
}
