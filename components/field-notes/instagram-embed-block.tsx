'use client'

import { instagramPermalinkToEmbedSrc } from "@/lib/utils/instagram-embed"
import { cn } from "@/lib/utils"

type Props = {
  url: string
  className?: string
}

/**
 * Inline Instagram embed (`/embed` iframe). Stored content is always a permalink validated at save time.
 */
export function InstagramEmbedBlock({ url, className }: Props) {
  const src = instagramPermalinkToEmbedSrc(url.trim())
  if (!src) {
    return (
      <p className="text-sm text-destructive" role="status">
        This Instagram URL could not be embedded. Edit the block and paste a regular post or reel link.
      </p>
    )
  }

  return (
    <div className={cn("mx-auto w-full max-w-[540px]", className)}>
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
        <iframe
          src={src}
          title="Embedded Instagram post"
          className="aspect-[10/13] min-h-[480px] w-full border-0 sm:min-h-[540px]"
          allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
          loading="lazy"
        />
      </div>
    </div>
  )
}
