"use client"

import Link from "next/link"
import Image from "next/image"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
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
    <div className={cn("mb-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Conversations by listing
        </p>
        <Link
          href={counterpartyHref}
          className="text-[12px] font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60"
        >
          View all ({threads.length})
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                "flex min-w-[9.5rem] max-w-[11rem] shrink-0 flex-col overflow-hidden rounded-xl border transition-colors",
                active
                  ? "border-foreground/25 bg-card shadow-sm ring-1 ring-foreground/10"
                  : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/35",
              )}
            >
              <div className="relative aspect-[4/3] w-full bg-muted">
                {thumb ? (
                  <Image src={thumb} alt={title} fill sizes="120px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-muted-foreground">
                    Chat
                  </div>
                )}
              </div>
              <div className="px-2 py-2">
                <p
                  className={cn(
                    "line-clamp-2 text-[12px] leading-snug",
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
