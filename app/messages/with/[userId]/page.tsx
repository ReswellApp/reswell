"use client"

import Link from "next/link"
import Image from "next/image"
import { use, useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/verified-badge"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { CounterpartyThreadsSkeleton } from "@/components/features/messages/messages-page-skeletons"
import { MessageProfileAvatar } from "@/components/features/messages/message-profile-avatar"
import { cn } from "@/lib/utils"
import {
  filterConversationsWithMessages,
  getConversationLastActivityMs,
  getLatestMessage,
  getUnreadCountForConversation,
  type InboxConversationRow,
} from "@/lib/utils/messages-inbox-grouping"
import { parseReviewRequestMessageMetadata } from "@/lib/validations/review-request-message-metadata"
import { parseMessageLocationMetadata } from "@/lib/validations/message-location-metadata"
import { isAbortError } from "@/lib/utils/is-abort-error"

type ProfileLite = {
  id: string
  display_name: string
  avatar_url: string | null
  shop_verified?: boolean
}

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
  const body = lastMessage.content.trim()
  return lastMessage.sender_id === currentUserId ? `You · ${body}` : body
}

export default function CounterpartyThreadsPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId: otherUserId } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<ProfileLite | null>(null)
  const [threads, setThreads] = useState<InboxConversationRow[]>([])

  const loadThreads = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!isActive()) return
      if (!user) {
        setLoading(false)
        return
      }
      setCurrentUserId(user.id)

      const [{ data: profile }, { data: convData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, shop_verified")
          .eq("id", otherUserId)
          .maybeSingle(),
        supabase
          .from("conversations")
          .select(`
          id,
          listing_id,
          buyer_id,
          seller_id,
          last_message_at,
          listing:listings(id, title, listing_images(url, thumbnail_url, is_primary)),
          buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
          seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified),
          messages(content, is_read, sender_id, created_at, metadata)
        `)
          .or(
            `and(buyer_id.eq.${user.id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${user.id})`,
          )
          .order("last_message_at", { ascending: false })
          .order("created_at", { ascending: true, referencedTable: "messages" }),
      ])
      if (!isActive()) return

      if (profile) {
        setOtherUser(profile as ProfileLite)
      } else {
        setOtherUser({
          id: otherUserId,
          display_name: "Member",
          avatar_url: null,
        })
      }

      const rows = filterConversationsWithMessages((convData ?? []) as unknown as InboxConversationRow[])
      const sorted = [...rows].sort(
        (a, b) => getConversationLastActivityMs(b) - getConversationLastActivityMs(a),
      )
      setThreads(sorted)
      setLoading(false)
    } catch (err) {
      if (isActive() && !isAbortError(err)) {
        setLoading(false)
      }
    }
  }, [otherUserId, supabase])

  useEffect(() => {
    let active = true
    void loadThreads(() => active).catch(() => {})
    return () => {
      active = false
    }
  }, [loadThreads])

  useEffect(() => {
    if (!loading && threads.length === 1) {
      router.replace(`/messages/${threads[0].id}`)
    }
  }, [loading, threads, router])

  const groupedShell =
    "overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none dark:border-border"

  if (loading) {
    return <CounterpartyThreadsSkeleton />
  }

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
