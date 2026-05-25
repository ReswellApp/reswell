"use client"

import Link from "next/link"
import Image from "next/image"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export type ListingThreadOption = {
  conversationId: string
  listingId: string | null
  listingTitle: string | null
  listingImages?: ListingImageForCard[] | null
  lastMessageAt: string
}

export function ConversationListingSwitcher({
  threads,
  activeConversationId,
  counterpartyHref,
  className,
}: {
  threads: ListingThreadOption[]
  activeConversationId: string
  counterpartyHref: string
  className?: string
}) {
  if (threads.length <= 1) return null

  const sorted = [...threads].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  )

  return (
    <div className={cn("mb-2 sm:mb-3", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1 sm:mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:text-[12px]">
          Conversations by listing
        </p>
        <Link
          href={counterpartyHref}
          className="text-[10px] font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60 sm:text-[12px]"
        >
          View all ({threads.length})
        </Link>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:gap-2 sm:pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sorted.map((thread) => {
          const active = thread.conversationId === activeConversationId
          const title = thread.listingTitle
            ? capitalizeWords(thread.listingTitle)
            : "General"
          const thumb = thread.listingImages
            ? listingTitleThumbnailSrc(thread.listingImages)
            : null

          return (
            <Link
              key={thread.conversationId}
              href={`/messages/${thread.conversationId}`}
              className={cn(
                "flex min-w-[5.25rem] max-w-[6rem] shrink-0 flex-col overflow-hidden rounded-lg border transition-colors sm:min-w-[9.5rem] sm:max-w-[11rem] sm:rounded-xl",
                active
                  ? "border-foreground/25 bg-card shadow-sm ring-1 ring-foreground/10"
                  : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/35",
              )}
            >
              <div className="relative aspect-square w-full bg-muted sm:aspect-[4/3]">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={title}
                    fill
                    sizes="(max-width: 640px) 72px, 120px"
                    className="object-cover"
                    unoptimized={listingImageShouldBypassOptimization(thumb)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                    Chat
                  </div>
                )}
              </div>
              <div className="px-1.5 py-1 sm:px-2 sm:py-2">
                <p
                  className={cn(
                    "truncate text-[10px] leading-snug sm:line-clamp-2 sm:text-[12px]",
                    active ? "font-semibold text-foreground" : "font-medium text-foreground/85",
                  )}
                >
                  {title}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
