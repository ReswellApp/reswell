"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/verified-badge"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import { cn } from "@/lib/utils"
import {
  getConversationLastActivityMs,
  getLatestMessage,
  getUnreadCountForConversation,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"
import { loadCounterpartyThreads, type CounterpartyThreadsData } from "@/app/actions/messages"
import { parseReviewRequestMessageMetadata } from "@/lib/validations/review-request-message-metadata"
import { parseMessageLocationMetadata } from "@/lib/validations/message-location-metadata"
import { formatMessageMediaPreviewText } from "@/lib/utils/message-media-preview-text"

function formatThreadPreview(
  lastMessage: InboxConversationRow["messages"][number] | undefined,
  currentUserId: string | null,
): string {
  if (!lastMessage?.content?.trim()) return "No messages yet"
  const reviewReq = parseReviewRequestMessageMetadata(lastMessage.metadata)
  if (reviewReq) {
    return lastMessage.sender_id === currentUserId ? "You asked for a review" : "Asked you for a review"
  }
  const sharedLoc = parseMessageLocationMetadata(lastMessage.metadata)
  if (sharedLoc) {
    return lastMessage.sender_id === currentUserId ? "You shared a location" : "Shared a location"
  }
  const mediaPreview = formatMessageMediaPreviewText({
    metadata: lastMessage.metadata,
    senderId: lastMessage.sender_id,
    currentUserId,
  })
  if (mediaPreview) return mediaPreview
  const body = lastMessage.content.trim()
  return lastMessage.sender_id === currentUserId ? `You · ${body}` : body
}

export interface CounterpartyThreadsClientProps {
  otherUserId: string
  initialData: CounterpartyThreadsData
}

export function CounterpartyThreadsClient({
  otherUserId,
  initialData,
}: CounterpartyThreadsClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const currentUserId = initialData.currentUserId
  const otherUser = initialData.otherUser
  const [threads, setThreads] = useState<InboxConversationRow[]>(() =>
    [...initialData.threads].sort(
      (a, b) => getConversationLastActivityMs(b) - getConversationLastActivityMs(a),
    ),
  )

  // A counterparty with a single thread is just that thread — skip the hop.
  useEffect(() => {
    if (threads.length === 1) {
      router.replace(`/messages/${threads[0].id}`)
    }
  }, [threads, router])

  // Live updates scoped to the user's own conversation rows (project convention:
  // realtime is always filtered to rows the user owns). A change re-reads the
  // shared threads server-side and patches previews/unread/order in place.
  useEffect(() => {
    let cancelled = false
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const applyFresh = async () => {
      const fresh = await loadCounterpartyThreads(otherUserId)
      if (cancelled || "error" in fresh) return
      setThreads(
        [...fresh.threads].sort(
          (a, b) => getConversationLastActivityMs(b) - getConversationLastActivityMs(a),
        ),
      )
    }

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = null
        void applyFresh().catch(() => {})
      }, 300)
    }

    const channels = (["buyer_id", "seller_id"] as const).map((column) =>
      supabase
        .channel(`counterparty:${column}:${currentUserId}:${otherUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
            filter: `${column}=eq.${currentUserId}`,
          },
          scheduleRefresh,
        )
        .subscribe(),
    )

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      for (const channel of channels) void supabase.removeChannel(channel)
    }
  }, [supabase, currentUserId, otherUserId])

  const groupedShell =
    "overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none dark:border-border"

  return (
    <main className="flex-1 bg-background">
      <div className="container mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-5 sm:pt-10 md:max-w-4xl lg:max-w-5xl">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/messages" className="shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full text-foreground hover:bg-muted/80"
              aria-label="Back to messages"
            >
              <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
            </Button>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <MessageProfileAvatar
              avatarUrl={otherUser?.avatar_url}
              displayName={otherUser?.display_name}
              pending={!otherUser}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate text-[22px] font-semibold tracking-tight text-foreground">
                  {otherUser?.display_name || "Member"}
                </h1>
                {otherUser?.shop_verified ? <VerifiedBadge size="sm" /> : null}
              </div>
              <p className="text-[14px] text-muted-foreground">
                {threads.length} listing conversation{threads.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </header>

        {threads.length === 0 ? (
          <div className={cn("px-6 py-14 text-center", groupedShell)}>
            <p className="text-[17px] font-medium text-foreground">No conversations yet</p>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Message this member from a listing to start a thread.
            </p>
          </div>
        ) : (
          <div className={cn("divide-y divide-border/40", groupedShell)}>
            {threads.map((thread) => {
              const lastMessage = getLatestMessage(thread)
              const unread = getUnreadCountForConversation(thread, currentUserId)
              const listing = thread.listing
              const thumb = listing?.listing_images
                ? listingTitleThumbnailSrc(listing.listing_images as ListingImageForCard[])
                : null
              const activityMs = getConversationLastActivityMs(thread)
              const title = listing?.title
                ? capitalizeWords(listing.title)
                : "General conversation"

              return (
                <Link
                  key={thread.id}
                  href={`/messages/${thread.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/35 active:bg-muted/55 sm:px-5"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/35">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={title}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized={listingImageShouldBypassOptimization(thumb)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-muted-foreground">
                        Chat
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[16px] font-semibold tracking-tight text-foreground">
                        {title}
                      </p>
                      {activityMs > 0 ? (
                        <time
                          className="shrink-0 text-[12px] tabular-nums text-muted-foreground"
                          dateTime={new Date(activityMs).toISOString()}
                        >
                          {formatDistanceToNow(new Date(activityMs), { addSuffix: true })}
                        </time>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-[14px] leading-snug text-muted-foreground",
                          unread > 0 && "font-medium text-foreground",
                        )}
                      >
                        {formatThreadPreview(lastMessage, currentUserId)}
                      </p>
                      {unread > 0 ? (
                        <span className="mt-0.5 flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold tabular-nums leading-none text-background">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
