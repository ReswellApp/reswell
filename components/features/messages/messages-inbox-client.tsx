'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MessageCircle, Heart, Search, Inbox, Handshake } from 'lucide-react'
import { MessagesOffersTab } from '@/components/features/messages/messages-offers-tab'
import { MessageProfileAvatar } from '@/components/features/messages/message-profile-avatar'
import {
  MessagesOffersTabSkeleton,
  MessagesActivityTabSkeleton,
} from '@/components/features/messages/messages-page-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { VerifiedBadge } from '@/components/verified-badge'
import { formatDistanceToNow } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailHref } from '@/lib/listing-href'
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from '@/lib/utils'
import { MessagesSupportDialog } from '@/components/features/messages/messages-support-dialog'
import { SellerMakeOfferToBuyerDialog } from '@/components/features/messages/seller-make-offer-to-buyer-dialog'
import type { MessagesInboxNotification } from '@/lib/db/messagesInbox'
import {
  groupConversationsByCounterparty,
  counterpartyInboxHref,
  type InboxConversationRow,
} from '@/lib/utils/messages-inbox-grouping'
import { parseReviewRequestMessageMetadata } from '@/lib/validations/review-request-message-metadata'
import { parseMessageLocationMetadata } from '@/lib/validations/message-location-metadata'
import { formatMessageMediaPreviewText } from '@/lib/utils/message-media-preview-text'
import { isAbortError } from '@/lib/utils/is-abort-error'

type SellerOfferDraft = {
  listingId: string
  buyerUserId: string
  listingTitle: string
  listPrice: number
  primaryImageUrl: string | null
}

type SentSellerActivityOffer = {
  offerId: string
  conversationId: string | null
}

function activitySellerOfferKey(listingId: string, buyerId: string): string {
  return `${listingId}:${buyerId}`
}

function sentOfferViewHref(
  sent: SentSellerActivityOffer,
  listingId: string,
  buyerId: string,
): string {
  if (sent.conversationId) return `/messages/${sent.conversationId}`
  return `/messages/new?user=${buyerId}&listing=${listingId}`
}

function activityKindLabel(type: string | undefined) {
  const t = (type || '').toLowerCase()
  if (t.includes('favorite') || t.includes('save') || t === 'listing_saved') return 'Favorite'
  if (t.includes('follow')) return 'Follow'
  if (t.startsWith('offer_')) return 'Offer'
  return 'Activity'
}

function isFavoriteActivityType(type: string | undefined) {
  const t = (type || '').toLowerCase()
  if (t.includes('follow')) return false
  return t === 'listing_saved' || t.includes('favorite') || t.includes('save')
}

interface Conversation extends InboxConversationRow {}

type MessagesTab = 'chats' | 'activity' | 'offers'

function parseMessagesTab(tabParam: string | null): MessagesTab {
  if (tabParam === 'activity') return 'activity'
  if (tabParam === 'offers') return 'offers'
  return 'chats'
}

function isOfferActivityType(type: string | undefined) {
  return (type || '').toLowerCase().startsWith('offer_')
}

export interface MessagesInboxClientProps {
  currentUserId: string
  initialConversations: InboxConversationRow[]
  initialNotifications: MessagesInboxNotification[]
}

export function MessagesInboxClient({
  currentUserId: initialUserId,
  initialConversations,
  initialNotifications,
}: MessagesInboxClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [notifications, setNotifications] = useState<MessagesInboxNotification[]>(initialNotifications)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>(initialUserId)
  const [sellerOfferDraft, setSellerOfferDraft] = useState<SellerOfferDraft | null>(null)
  const [sentSellerOffersByKey, setSentSellerOffersByKey] = useState<
    Record<string, SentSellerActivityOffer>
  >({})
  const supabase = createClient()

  const loadSentSellerOffers = useCallback(
    async (sellerId: string, isActive: () => boolean = () => true) => {
      try {
        const { data: sentOffers } = await supabase
          .from('offers')
          .select('id, listing_id, buyer_id, created_at')
          .eq('seller_id', sellerId)
          .eq('seller_initiated', true)
          .order('created_at', { ascending: false })
        if (!isActive()) return

        const offerRows = sentOffers ?? []
        if (offerRows.length === 0) {
          setSentSellerOffersByKey({})
          return
        }

        const buyerIds = [...new Set(offerRows.map((row) => row.buyer_id as string))]
        const { data: convRows } = await supabase
          .from('conversations')
          .select('id, listing_id, buyer_id')
          .eq('seller_id', sellerId)
          .in('buyer_id', buyerIds)
        if (!isActive()) return

        const conversationByKey = new Map<string, string>()
        for (const row of convRows ?? []) {
          const listingId = row.listing_id as string | null
          const buyerId = row.buyer_id as string | null
          if (!listingId || !buyerId) continue
          conversationByKey.set(activitySellerOfferKey(listingId, buyerId), row.id as string)
        }

        const next: Record<string, SentSellerActivityOffer> = {}
        for (const row of offerRows) {
          const listingId = row.listing_id as string | null
          const buyerId = row.buyer_id as string | null
          const offerId = row.id as string | null
          if (!listingId || !buyerId || !offerId) continue
          const key = activitySellerOfferKey(listingId, buyerId)
          if (next[key]) continue
          next[key] = {
            offerId,
            conversationId: conversationByKey.get(key) ?? null,
          }
        }

        setSentSellerOffersByKey(next)
      } catch (err) {
        if (!isAbortError(err)) {
          setSentSellerOffersByKey({})
        }
      }
    },
    [supabase],
  )

  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<MessagesTab>(() => parseMessagesTab(tabParam))

  useEffect(() => {
    setTab(parseMessagesTab(tabParam))
  }, [tabParam])

  useEffect(() => {
    setCurrentUserId(initialUserId)
    setConversations(initialConversations)
    setNotifications(initialNotifications)
    setLoading(false)
  }, [initialUserId, initialConversations, initialNotifications])

  const setMessagesTab = useCallback(
    (next: MessagesTab) => {
      setTab(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'chats') {
        params.delete('tab')
      } else {
        params.set('tab', next)
      }
      const q = params.toString()
      router.replace(q ? `/messages?${q}` : '/messages', { scroll: false })
    },
    [router, searchParams],
  )

  useEffect(() => {
    if (!currentUserId) return

    let cancelled = false

    void (async () => {
      try {
        await fetch('/api/me/offers-sync-threads', { method: 'POST', credentials: 'include' })
      } catch (err) {
        if (!isAbortError(err)) {
          // non-blocking
        }
      }
      if (!cancelled) {
        void loadSentSellerOffers(currentUserId, () => !cancelled)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUserId, loadSentSellerOffers])

  useEffect(() => {
    if (!currentUserId) return

    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    let cancelled = false

    void (async () => {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
      if (!cancelled && typeof window !== 'undefined') {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('unreadCountRefresh')), 150)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUserId, notifications, supabase])

  useEffect(() => {
    if (tab !== 'activity' || !currentUserId) return
    let active = true
    void loadSentSellerOffers(currentUserId, () => active)
    return () => {
      active = false
    }
  }, [tab, currentUserId, loadSentSellerOffers])

  const searchLower = searchQuery.trim().toLowerCase()

  const groupedChats = groupConversationsByCounterparty(conversations, currentUserId)

  const filteredGroups = groupedChats.filter((group) => {
    if (!searchLower) return true
    const name = group.otherUser?.display_name?.toLowerCase() ?? ''
    const listingTitles = group.threads
      .map((t) => t.listing?.title?.toLowerCase() ?? '')
      .join(' ')
    const preview = (group.latestMessage?.content || '').toLowerCase()
    return (
      name.includes(searchLower) ||
      listingTitles.includes(searchLower) ||
      preview.includes(searchLower)
    )
  })

  const totalUnreadChats = groupedChats.reduce((acc, group) => acc + group.totalUnread, 0)

  const activityNotifications = notifications.filter((n) => !isOfferActivityType(n.type))

  const filteredNotifications = activityNotifications.filter((n) => {
    if (!searchLower) return true
    const listing = n.listings
    const text = (n.message || '').toLowerCase()
    const title = listing?.title?.toLowerCase() ?? ''
    return text.includes(searchLower) || title.includes(searchLower)
  })

  function formatChatPreviewText(
    lastMessage: Conversation['messages'][number] | undefined,
    listingTitle: string | undefined,
    currentId: string | null,
  ): string {
    const listing = listingTitle?.trim() ? capitalizeWords(listingTitle.trim()) : ''
    const reviewReq = parseReviewRequestMessageMetadata(lastMessage?.metadata)
    if (reviewReq && lastMessage) {
      const you = lastMessage.sender_id === currentId
      const hint = you ? 'You asked for a review' : 'Asked you for a review'
      if (listing) return `${listing} · ${hint}`
      return hint
    }
    const sharedLoc = parseMessageLocationMetadata(lastMessage?.metadata)
    if (sharedLoc && lastMessage) {
      const you = lastMessage.sender_id === currentId
      const hint = you ? 'You shared a location' : 'Shared a location'
      if (listing) return `${listing} · ${hint}`
      return hint
    }
    const mediaPreview = formatMessageMediaPreviewText({
      metadata: lastMessage?.metadata,
      senderId: lastMessage?.sender_id ?? '',
      currentUserId: currentId,
    })
    if (mediaPreview && lastMessage) {
      if (listing) return `${listing} · ${mediaPreview}`
      return mediaPreview
    }
    if (!lastMessage?.content?.trim()) {
      return listing || 'No messages yet'
    }
    const body = lastMessage.content.trim()
    const you = lastMessage.sender_id === currentId
    const segment = you ? `You · ${body}` : body
    if (listing) return `${listing} · ${segment}`
    return segment
  }

  const groupedShell =
    'overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none dark:border-border'

  const activityShell =
    'rounded-[22px] border border-dashed border-border/60 bg-muted/20 p-3 sm:p-4 ring-1 ring-foreground/[0.03]'

  return (
    <main className="flex-1 bg-background">
      <div className="container mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-5 sm:pt-10 md:max-w-4xl lg:max-w-5xl">
        {loading ? (
          <>
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-9 w-48 sm:h-10" />
                <Skeleton className="h-4 w-full max-w-xl bg-muted/70" />
              </div>
              <Skeleton className="h-11 w-full shrink-0 rounded-full sm:mt-1 sm:w-36" />
            </header>
            <Skeleton className="mb-5 h-12 w-full rounded-2xl" />
          </>
        ) : (
          <>
            <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[34px]">
                  Messages
                </h1>
                <p className="mt-1 max-w-xl text-[15px] leading-snug text-muted-foreground">
                  Conversations about your listings and purchases. Reach Reswell anytime with Need help?
                </p>
              </div>
              <div className="shrink-0 self-start sm:mt-1 w-full sm:w-auto">
                  <MessagesSupportDialog triggerClassName="w-full sm:w-auto" />
                </div>
            </header>

            <div className="relative mb-5">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                placeholder={
                  tab === 'activity'
                    ? 'Search activity'
                    : tab === 'offers'
                      ? 'Search offers'
                      : 'Search chats'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'h-12 rounded-2xl border-border/80 bg-muted/80 pl-11 pr-4 text-[17px] shadow-none',
                  'placeholder:text-muted-foreground/80',
                  'focus-visible:border-border focus-visible:ring-2 focus-visible:ring-foreground/5',
                )}
              />
            </div>
          </>
        )}

        {loading ? (
          <>
            <div
              className="mb-6 flex w-full gap-1 rounded-2xl border border-border/70 bg-muted/60 p-1 shadow-[inset_0_1px_2px_rgba(17,17,17,0.04)]"
              aria-hidden
            >
              <Skeleton className="h-[46px] flex-1 rounded-[11px] sm:h-[48px]" />
              <Skeleton className="h-[46px] flex-1 rounded-[11px] bg-muted/60 sm:h-[48px]" />
              <Skeleton className="h-[46px] flex-1 rounded-[11px] bg-muted/50 sm:h-[48px]" />
            </div>
            {tab === 'offers' ? (
              <MessagesOffersTabSkeleton shellClassName={groupedShell} />
            ) : tab === 'activity' ? (
              <MessagesActivityTabSkeleton shellClassName={activityShell} />
            ) : (
              <div className={cn('divide-y divide-border/60', groupedShell)}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
                    <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-3 w-14 shrink-0" />
                      </div>
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Segmented control: instant switch between chats and activity */}
            <div
              className="mb-6 flex w-full gap-1 rounded-2xl border border-border/70 bg-muted/60 p-1 shadow-[inset_0_1px_2px_rgba(17,17,17,0.04)]"
              role="tablist"
              aria-label="Messages, activity, and offers"
            >
              <button
                type="button"
                role="tab"
                id="messages-tab-chats"
                aria-selected={tab === 'chats'}
                aria-controls="messages-panel-chats"
                onClick={() => setMessagesTab('chats')}
                className={cn(
                  'flex min-h-touch min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-2.5 text-[15px] font-semibold transition-colors sm:gap-2 sm:px-3',
                  tab === 'chats'
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Inbox className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">Chats</span>
                {groupedChats.length > 0 && (
                  <span className="tabular-nums text-[13px] font-medium text-muted-foreground">
                    {filteredGroups.length !== groupedChats.length && searchLower
                      ? `${filteredGroups.length}/${groupedChats.length}`
                      : groupedChats.length}
                  </span>
                )}
                {totalUnreadChats > 0 && (
                  <span
                    className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold tabular-nums leading-none text-background"
                    aria-label={`${totalUnreadChats} unread messages`}
                  >
                    {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                id="messages-tab-activity"
                aria-selected={tab === 'activity'}
                aria-controls="messages-panel-activity"
                onClick={() => setMessagesTab('activity')}
                className={cn(
                  'flex min-h-touch min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-2.5 text-[15px] font-semibold transition-colors sm:gap-2 sm:px-3',
                  tab === 'activity'
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Heart className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">Activity</span>
                {activityNotifications.length > 0 && (
                  <span className="tabular-nums text-[13px] font-medium text-muted-foreground">
                    {filteredNotifications.length !== activityNotifications.length && searchLower
                      ? `${filteredNotifications.length}/${activityNotifications.length}`
                      : activityNotifications.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                id="messages-tab-offers"
                aria-selected={tab === 'offers'}
                aria-controls="messages-panel-offers"
                onClick={() => setMessagesTab('offers')}
                className={cn(
                  'flex min-h-touch min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-2.5 text-[15px] font-semibold transition-colors sm:gap-2 sm:px-3',
                  tab === 'offers'
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Handshake className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">Offers</span>
              </button>
            </div>

            {/* Chats */}
            <section
              id="messages-panel-chats"
              role="tabpanel"
              aria-labelledby="messages-tab-chats"
              hidden={tab !== 'chats'}
            >
              {filteredGroups.length === 0 ? (
                <div
                  className={cn(
                    'flex flex-col items-center px-6 py-14 text-center sm:py-16',
                    groupedShell,
                  )}
                >
                  {searchLower && groupedChats.length > 0 ? (
                    <>
                      <p className="text-[17px] font-medium text-foreground">No matching chats</p>
                      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                        Try another name or listing title.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <MessageCircle className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-[20px] font-semibold tracking-tight text-foreground">
                        No messages yet
                      </h3>
                      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                        When you contact a seller or receive a message, it will appear here.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className={cn('divide-y divide-border/40', groupedShell)}>
                  {filteredGroups.map((group) => {
                    const otherUser = group.otherUser
                    const lastMessage = group.latestMessage
                    const lastActivityMs = group.latestActivityMs
                    const unreadCount = group.totalUnread
                    const primaryListingTitle = group.primaryThread.listing?.title
                      ? capitalizeWords(group.primaryThread.listing.title)
                      : undefined
                    const previewText = formatChatPreviewText(
                      lastMessage,
                      primaryListingTitle,
                      currentUserId,
                    )
                    const listingCount = group.threads.length

                    return (
                      <Link
                        key={group.otherUserId}
                        href={counterpartyInboxHref(group)}
                        className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/35 active:bg-muted/55 sm:px-5"
                      >
                        <MessageProfileAvatar
                          avatarUrl={otherUser?.avatar_url}
                          displayName={otherUser?.display_name}
                          pending={!otherUser}
                          size="md"
                          className="ring-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  'truncate text-[17px] leading-tight tracking-tight text-foreground',
                                  unreadCount > 0 ? 'font-semibold' : 'font-medium',
                                )}
                              >
                                {otherUser?.display_name || 'Unknown User'}
                              </span>
                              {otherUser?.shop_verified && (
                                <span className="shrink-0">
                                  <VerifiedBadge size="sm" />
                                </span>
                              )}
                              {listingCount > 1 ? (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border/40">
                                  {listingCount} listings
                                </span>
                              ) : null}
                            </div>
                            {lastActivityMs > 0 ? (
                              <time
                                className="shrink-0 text-[13px] tabular-nums text-muted-foreground"
                                dateTime={new Date(lastActivityMs).toISOString()}
                              >
                                {formatDistanceToNow(new Date(lastActivityMs), {
                                  addSuffix: true,
                                })}
                              </time>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                'min-w-0 flex-1 truncate text-[15px] leading-snug text-muted-foreground',
                                unreadCount > 0 && 'font-medium text-foreground',
                              )}
                            >
                              {previewText}
                            </p>
                            {unreadCount > 0 && (
                              <span
                                className="mt-0.5 flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-foreground px-1.5 text-[12px] font-semibold tabular-nums leading-none text-background"
                                aria-label={`${unreadCount} unread`}
                              >
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Activity */}
            <section
              id="messages-panel-activity"
              role="tabpanel"
              aria-labelledby="messages-tab-activity"
              hidden={tab !== 'activity'}
            >
              {activityNotifications.length === 0 ? (
                <div
                  className={cn(
                    'flex flex-col items-center px-6 py-14 text-center sm:py-16',
                    activityShell,
                  )}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <Heart className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[17px] font-semibold text-foreground">No activity yet</h3>
                  <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                    When someone favorites your listing or follows you, updates will show here.
                  </p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className={cn('px-4 py-10 text-center', activityShell)}>
                  <p className="text-[15px] text-muted-foreground">No matching activity.</p>
                </div>
              ) : (
                <div className={cn('space-y-2.5 sm:space-y-3', activityShell)}>
                  {filteredNotifications.map((n) => {
                      const listing = n.listings
                      const href =
                        n.listing_id && listing?.section ? listingDetailHref(listing) : '/favorites'
                      const thumb =
                        listing?.listing_images &&
                        listingTitleThumbnailSrc(listing.listing_images)
                      const kind = activityKindLabel(n.type)
                      const showSellerOfferCta =
                        !!n.actor_id &&
                        !!n.listing_id &&
                        isFavoriteActivityType(n.type) &&
                        n.actor_id !== currentUserId
                      const listPriceRaw = listing?.price
                      const listPriceNum =
                        typeof listPriceRaw === 'number'
                          ? listPriceRaw
                          : parseFloat(String(listPriceRaw ?? ''))
                      const canSellerOffer =
                        showSellerOfferCta && Number.isFinite(listPriceNum) && listPriceNum > 0
                      const sentOffer =
                        n.listing_id && n.actor_id
                          ? sentSellerOffersByKey[activitySellerOfferKey(n.listing_id, n.actor_id)]
                          : undefined

                      return (
                        <article
                          key={n.id}
                          className="group flex flex-col gap-2.5 rounded-2xl border border-border/50 bg-background/90 p-3 transition-all hover:border-border hover:shadow-[0_2px_12px_rgba(17,17,17,0.06)] dark:hover:shadow-none"
                        >
                          <Link
                            href={href}
                            className="flex gap-3 rounded-xl outline-none ring-offset-background transition-[transform,box-shadow] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/35">
                              {thumb ? (
                                <>
                                  <Image
                                    key={thumb}
                                    src={thumb}
                                    alt={listing?.title ? capitalizeWords(listing.title) : 'Listing'}
                                    fill
                                    sizes="60px"
                                    className="object-cover"
                                    unoptimized={listingImageShouldBypassOptimization(thumb)}
                                  />
                                  <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/95 shadow-md ring-1 ring-border/40">
                                    <Heart
                                      className="h-3.5 w-3.5 fill-foreground/15 text-foreground"
                                      aria-hidden
                                    />
                                  </span>
                                </>
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Heart className="h-7 w-7 text-muted-foreground/70" strokeWidth={1.5} />
                                </div>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col py-0.5">
                              {listing?.title && (
                                <p className="truncate text-[13px] font-medium text-muted-foreground">
                                  {capitalizeWords(listing.title)}
                                </p>
                              )}
                              <div className="mt-1.5 flex min-w-0 items-end justify-between gap-3">
                                <div className="flex min-w-0 items-baseline gap-2">
                                  <span className="shrink-0 rounded-full bg-muted/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground ring-1 ring-border/40">
                                    {kind}
                                  </span>
                                  <p className="min-w-0 truncate text-[15px] font-medium leading-snug text-foreground">
                                    {n.message || 'Someone saved your item'}
                                  </p>
                                </div>
                                <time
                                  className="shrink-0 text-[12px] tabular-nums text-muted-foreground"
                                  dateTime={n.created_at}
                                >
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </time>
                              </div>
                            </div>
                          </Link>
                          {showSellerOfferCta ? (
                            <div className="flex justify-end border-t border-border/40 pt-2.5 sm:justify-start sm:border-t-0 sm:pt-0 sm:pl-[72px]">
                              {sentOffer ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold"
                                >
                                  <Link
                                    href={sentOfferViewHref(
                                      sentOffer,
                                      n.listing_id!,
                                      n.actor_id!,
                                    )}
                                  >
                                    View the offer you sent
                                  </Link>
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold"
                                  disabled={!canSellerOffer}
                                  title={
                                    !canSellerOffer
                                      ? 'Add a list price to this listing before sending an offer.'
                                      : undefined
                                  }
                                  onClick={() => {
                                    if (!canSellerOffer || !n.listing_id || !n.actor_id || !listing) return
                                    setSellerOfferDraft({
                                      listingId: n.listing_id,
                                      buyerUserId: n.actor_id,
                                      listingTitle: listing.title ?? '',
                                      listPrice: listPriceNum,
                                      primaryImageUrl: thumb ?? null,
                                    })
                                  }}
                                >
                                  Make them an offer
                                </Button>
                              )}
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                )}
            </section>

            {/* Offers */}
            <section
              id="messages-panel-offers"
              role="tabpanel"
              aria-labelledby="messages-tab-offers"
              hidden={tab !== 'offers'}
            >
              {currentUserId ? (
                <MessagesOffersTab
                  userId={currentUserId}
                  searchQuery={searchQuery}
                  shellClassName={groupedShell}
                />
              ) : null}
            </section>
          </>
        )}
      </div>

      {sellerOfferDraft ? (
        <SellerMakeOfferToBuyerDialog
          open
          onOpenChange={(next) => {
            if (!next) setSellerOfferDraft(null)
          }}
          listingId={sellerOfferDraft.listingId}
          buyerUserId={sellerOfferDraft.buyerUserId}
          sellerUserId={currentUserId ?? ''}
          listingTitle={sellerOfferDraft.listingTitle}
          listPrice={sellerOfferDraft.listPrice}
          primaryImageUrl={sellerOfferDraft.primaryImageUrl}
          onOfferSent={({ listingId, buyerUserId, offerId, conversationId }) => {
            setSentSellerOffersByKey((prev) => ({
              ...prev,
              [activitySellerOfferKey(listingId, buyerUserId)]: {
                offerId,
                conversationId,
              },
            }))
          }}
        />
      ) : null}
    </main>
  )
}
