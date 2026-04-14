'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { MessageCircle, Heart, Search, Inbox } from 'lucide-react'
import { VerifiedBadge } from '@/components/verified-badge'
import { formatDistanceToNow } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailHref } from '@/lib/listing-href'
import { cn } from '@/lib/utils'
import { getConversationForBuyerSeller } from '@/lib/db/conversations'

interface Notification {
  id: string
  type: string
  listing_id: string | null
  message: string | null
  is_read: boolean
  created_at: string
  listing?: { id: string; slug?: string | null; title: string; section: string; listing_images?: { url: string }[] } | null
  listings?: { id: string; slug?: string | null; title: string; section: string; listing_images?: { url: string }[] } | null
}

function activityKindLabel(type: string | undefined) {
  const t = (type || '').toLowerCase()
  if (t.includes('favorite') || t.includes('save') || t === 'listing_saved') return 'Favorite'
  if (t.includes('follow')) return 'Follow'
  if (t.startsWith('offer_')) return 'Offer'
  return 'Activity'
}

interface Conversation {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  last_message_at: string
  listing: {
    id: string
    title: string
    listing_images: { url: string }[]
  } | null
  buyer: {
    id: string
    display_name: string
    avatar_url: string | null
    shop_verified?: boolean
  }
  seller: {
    id: string
    display_name: string
    avatar_url: string | null
    shop_verified?: boolean
  }
  messages: {
    content: string
    is_read: boolean
    sender_id: string
    created_at: string
  }[]
}

type MessagesTab = 'chats' | 'activity'

function MessagesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<MessagesTab>(() => (tabParam === 'activity' ? 'activity' : 'chats'))

  const userParam = searchParams.get('user')
  const listingParam = searchParams.get('listing')

  useEffect(() => {
    setTab(tabParam === 'activity' ? 'activity' : 'chats')
  }, [tabParam])

  const setMessagesTab = useCallback(
    (next: MessagesTab) => {
      setTab(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'activity') {
        params.set('tab', 'activity')
      } else {
        params.delete('tab')
      }
      const q = params.toString()
      router.replace(q ? `/messages?${q}` : '/messages', { scroll: false })
    },
    [router, searchParams],
  )

  useEffect(() => {
    async function fetchConversations() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      // Repair offer rows that never mirrored into `messages` (legacy / failed sync)
      try {
        await fetch("/api/me/offers-sync-threads", { method: "POST", credentials: "include" })
      } catch {
        // non-blocking
      }

      // If we have user + listing params, open the single buyer↔seller thread (set listing context) and redirect
      if (userParam && listingParam && userParam !== user.id) {
        let conv = await getConversationForBuyerSeller(supabase, user.id, userParam)

        if (!conv) {
          const { data: newConv, error: createErr } = await supabase
            .from('conversations')
            .insert({
              buyer_id: user.id,
              seller_id: userParam,
              listing_id: listingParam,
            })
            .select('id')
            .single()
          if (!createErr && newConv) conv = { id: newConv.id, listing_id: listingParam }
        } else if (conv.listing_id !== listingParam) {
          await supabase.from('conversations').update({ listing_id: listingParam }).eq('id', conv.id)
        }
        if (conv) {
          window.location.replace(`/messages/${conv.id}`)
          return
        }
      }

      const [{ data, error }, { data: notifData }] = await Promise.all([
        supabase
          .from('conversations')
          .select(`
            *,
            listing:listings(id, title, listing_images(url)),
            buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
            seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified),
            messages(content, is_read, sender_id, created_at)
          `)
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false })
          .order('created_at', { ascending: true, referencedTable: 'messages' }),
        supabase
          .from('notifications')
          .select(`
            id,
            type,
            listing_id,
            message,
            is_read,
            created_at,
            listings(id, slug, title, section, listing_images(url))
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (!error && data) {
        setConversations(data as Conversation[])
      }
      if (notifData) {
        setNotifications(notifData as unknown as Notification[])
        const unreadIds = (notifData as unknown as Notification[]).filter((n) => !n.is_read).map((n) => n.id)
        if (unreadIds.length > 0) {
          await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
          if (typeof window !== 'undefined') {
            window.setTimeout(() => window.dispatchEvent(new CustomEvent('unreadCountRefresh')), 150)
          }
        }
      }
      setLoading(false)
    }

    fetchConversations()
  }, [supabase, userParam, listingParam])

  const searchLower = searchQuery.trim().toLowerCase()

  const filteredConversations = conversations.filter((conv) => {
    const otherUser = conv.buyer_id === currentUserId ? conv.seller : conv.buyer
    if (!searchLower) return true
    return (
      otherUser?.display_name?.toLowerCase().includes(searchLower) ||
      conv.listing?.title?.toLowerCase().includes(searchLower)
    )
  })

  const filteredNotifications = notifications.filter((n) => {
    if (!searchLower) return true
    const listing = n.listing ?? n.listings
    const text = (n.message || '').toLowerCase()
    const title = listing?.title?.toLowerCase() ?? ''
    return text.includes(searchLower) || title.includes(searchLower)
  })

  const getUnreadCount = (conv: Conversation) => {
    return conv.messages.filter(m => !m.is_read && m.sender_id !== currentUserId).length
  }

  const totalUnreadChats = conversations.reduce((acc, conv) => acc + getUnreadCount(conv), 0)

  function getLatestMessage(conv: Conversation): Conversation['messages'][number] | undefined {
    if (!conv.messages?.length) return undefined
    return [...conv.messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ).at(-1)
  }

  function formatChatPreviewText(
    lastMessage: Conversation['messages'][number] | undefined,
    listingTitle: string | undefined,
    currentId: string | null,
  ): string {
    const listing = listingTitle?.trim() ? capitalizeWords(listingTitle.trim()) : ''
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
    <main className="flex-1 bg-gradient-to-b from-muted/40 to-background">
      <div className="container mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-5 sm:pt-10">
        <header className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[34px]">
            Messages
          </h1>
          <p className="mt-1 text-[15px] leading-snug text-muted-foreground">
            Conversations about your listings and purchases.
          </p>
        </header>

        <div className="relative mb-5">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={tab === 'activity' ? 'Search activity' : 'Search chats'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'h-12 rounded-2xl border-border/80 bg-muted/80 pl-11 pr-4 text-[17px] shadow-none',
              'placeholder:text-muted-foreground/80',
              'focus-visible:border-border focus-visible:ring-2 focus-visible:ring-foreground/5',
            )}
          />
        </div>

        {loading ? (
          <>
            <div
              className="mb-6 flex w-full gap-1 rounded-2xl border border-border/70 bg-muted/60 p-1 shadow-[inset_0_1px_2px_rgba(17,17,17,0.04)]"
              aria-hidden
            >
              <div className="h-[46px] flex-1 animate-pulse rounded-[11px] bg-muted/90 sm:h-[48px]" />
              <div className="h-[46px] flex-1 animate-pulse rounded-[11px] bg-muted/50 sm:h-[48px]" />
            </div>
            <div className={cn('divide-y divide-border/60', groupedShell)}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3.5 px-4 py-3.5">
                  <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/5 rounded-md bg-muted" />
                    <div className="h-3 w-4/5 rounded-md bg-muted/80" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Segmented control: instant switch between chats and activity */}
            <div
              className="mb-6 flex w-full gap-1 rounded-2xl border border-border/70 bg-muted/60 p-1 shadow-[inset_0_1px_2px_rgba(17,17,17,0.04)]"
              role="tablist"
              aria-label="Messages and activity"
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
                {conversations.length > 0 && (
                  <span className="tabular-nums text-[13px] font-medium text-muted-foreground">
                    {filteredConversations.length !== conversations.length && searchLower
                      ? `${filteredConversations.length}/${conversations.length}`
                      : conversations.length}
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
                {notifications.length > 0 && (
                  <span className="tabular-nums text-[13px] font-medium text-muted-foreground">
                    {filteredNotifications.length !== notifications.length && searchLower
                      ? `${filteredNotifications.length}/${notifications.length}`
                      : notifications.length}
                  </span>
                )}
              </button>
            </div>

            {/* Chats */}
            <section
              id="messages-panel-chats"
              role="tabpanel"
              aria-labelledby="messages-tab-chats"
              hidden={tab !== 'chats'}
            >
              {filteredConversations.length === 0 ? (
                <div
                  className={cn(
                    'flex flex-col items-center px-6 py-14 text-center sm:py-16',
                    groupedShell,
                  )}
                >
                  {searchLower && conversations.length > 0 ? (
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
                  {filteredConversations.map((conv) => {
                    const otherUser = conv.buyer_id === currentUserId ? conv.seller : conv.buyer
                    const lastMessage = getLatestMessage(conv)
                    const unreadCount = getUnreadCount(conv)
                    const initial = (otherUser?.display_name?.trim()?.[0] || '?').toUpperCase()
                    const listingTitle = conv.listing?.title
                      ? capitalizeWords(conv.listing.title)
                      : undefined
                    const previewText = formatChatPreviewText(lastMessage, listingTitle, currentUserId)

                    return (
                      <Link
                        key={conv.id}
                        href={`/messages/${conv.id}`}
                        className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/35 active:bg-muted/55 sm:px-5"
                      >
                        <div className="relative h-12 w-12 shrink-0">
                          <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                            {otherUser?.avatar_url ? (
                              <Image
                                src={otherUser.avatar_url || '/placeholder.svg'}
                                alt={otherUser.display_name || 'Conversation'}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[15px] font-medium text-muted-foreground">
                                {initial}
                              </div>
                            )}
                          </div>
                        </div>
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
                            </div>
                            <time
                              className="shrink-0 text-[13px] tabular-nums text-muted-foreground"
                              dateTime={conv.last_message_at}
                            >
                              {formatDistanceToNow(new Date(conv.last_message_at), {
                                addSuffix: true,
                              })}
                            </time>
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
              {notifications.length === 0 ? (
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
                    When someone favorites your listing or other updates arrive, they will show here.
                  </p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className={cn('px-4 py-10 text-center', activityShell)}>
                  <p className="text-[15px] text-muted-foreground">No matching activity.</p>
                </div>
              ) : (
                <div className={cn('space-y-2.5 sm:space-y-3', activityShell)}>
                  {filteredNotifications.map((n) => {
                      const listing = n.listing ?? n.listings
                      const href =
                        n.listing_id && listing?.section ? listingDetailHref(listing) : '/favorites'
                      const thumb = listing?.listing_images?.[0]?.url
                      const kind = activityKindLabel(n.type)

                      return (
                        <Link
                          key={n.id}
                          href={href}
                          className="group flex gap-3 rounded-2xl border border-border/50 bg-background/90 p-3 transition-all hover:border-border hover:shadow-[0_2px_12px_rgba(17,17,17,0.06)] active:scale-[0.99] dark:hover:shadow-none"
                        >
                          <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/35">
                            {thumb ? (
                              <>
                                <Image
                                  src={thumb}
                                  alt={listing?.title ? capitalizeWords(listing.title) : 'Listing'}
                                  fill
                                  className="object-cover"
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
                      )
                    })}
                  </div>
                )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 bg-gradient-to-b from-muted/40 to-background">
          <div className="container mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-5 sm:pt-10">
            <div className="mb-8 space-y-2">
              <div className="h-9 w-48 animate-pulse rounded-lg bg-muted sm:h-10" />
              <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted/70" />
            </div>
            <div className="mb-8 h-12 animate-pulse rounded-2xl bg-muted/80" />
            <div className="mb-6 flex w-full gap-1 rounded-2xl border border-border/70 bg-muted/60 p-1">
              <div className="h-[46px] flex-1 animate-pulse rounded-[11px] bg-muted/90 sm:h-[48px]" />
              <div className="h-[46px] flex-1 animate-pulse rounded-[11px] bg-muted/50 sm:h-[48px]" />
            </div>
            <div className="overflow-hidden rounded-[20px] border border-border/70 bg-card divide-y divide-border/60">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3.5 px-4 py-3.5">
                  <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/5 rounded-md bg-muted" />
                    <div className="h-3 w-4/5 rounded-md bg-muted/80" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      }
    >
      <MessagesContent />
    </Suspense>
  )
}
