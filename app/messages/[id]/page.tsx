'use client'

import { useEffect, useState, useRef, useMemo, use, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VerifiedBadge } from '@/components/verified-badge'
import { format, isToday, isYesterday } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailPath } from '@/lib/listing-query'
import { sendConversationReply } from '@/app/actions/messages'
import { OfferMessageCard } from '@/components/features/messages/offer-message-card'
import {
  OfferLegacyMirrorCard,
  OfferNegotiationEventCard,
} from '@/components/features/messages/offer-negotiation-event-card'
import type { OfferRowLite } from '@/components/features/messages/seller-offer-response-dialog'
import { parseOfferNegotiationMessage } from '@/lib/utils/parse-offer-negotiation-message'
import { parseOrderPlacedMessageMetadata } from '@/lib/validations/order-placed-message-metadata'
import { OrderPlacedMessageCard } from '@/components/features/messages/order-placed-message-card'

interface Message {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
  offer_id?: string | null
  metadata?: unknown | null
}

interface Conversation {
  id: string
  listing_id: string | null
  buyer_id: string
  seller_id: string
  listing: {
    id: string
    title: string
    price: number
    section: string
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
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [offersById, setOffersById] = useState<Record<string, OfferRowLite>>({})
  const [listingOfferMinPct, setListingOfferMinPct] = useState(70)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const supabase = createClient()

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  )

  const listPriceNum = useMemo(() => {
    const p = conversation?.listing?.price
    if (p === undefined || p === null) return 0
    const n = typeof p === 'number' ? p : parseFloat(String(p))
    return Math.round(n * 100) / 100
  }, [conversation?.listing?.price])

  const minOfferAmount = useMemo(() => {
    return Math.round(listPriceNum * (listingOfferMinPct / 100) * 100) / 100
  }, [listPriceNum, listingOfferMinPct])

  const listingTitleForOffers = conversation?.listing?.title ?? ''

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = messagesScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    stickToBottomRef.current = true
  }, [id])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const onScroll = () => {
      const thresholdPx = 72
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distanceFromBottom < thresholdPx
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [conversation])

  useEffect(() => {
    if (!stickToBottomRef.current) return
    const idFrame = requestAnimationFrame(() => {
      scrollThreadToBottom()
    })
    return () => cancelAnimationFrame(idFrame)
  }, [orderedMessages, scrollThreadToBottom])

  const loadThread = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: convData } = await supabase
      .from('conversations')
      .select(`
          *,
          listing:listings(id, title, price, section, slug, listing_images(url)),
          buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
          seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified)
        `)
      .eq('id', id)
      .single()

    if (convData) {
      setConversation(convData as Conversation)
      if (convData.listing_id) {
        const { data: settings } = await supabase
          .from('offer_settings')
          .select('minimum_offer_pct')
          .eq('listing_id', convData.listing_id)
          .maybeSingle()
        setListingOfferMinPct(settings?.minimum_offer_pct ?? 70)
      } else {
        setListingOfferMinPct(70)
      }
    }

    const { data: msgData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    const rows = (msgData ?? []) as Message[]
    setMessages(rows)

    const offerIds = [...new Set(rows.map((m) => m.offer_id).filter(Boolean))] as string[]
    if (offerIds.length > 0) {
      const { data: offerRows } = await supabase
        .from('offers')
        .select('id, status, current_amount, buyer_id, seller_id, listing_id')
        .in('id', offerIds)
      if (offerRows?.length) {
        const next: Record<string, OfferRowLite> = {}
        for (const o of offerRows) {
          next[o.id as string] = o as OfferRowLite
        }
        setOffersById(next)
      } else {
        setOffersById({})
      }
    } else {
      setOffersById({})
    }

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (typeof window !== 'undefined') {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('unreadCountRefresh')), 150)
    }
  }, [id, supabase])

  useEffect(() => {
    void loadThread()

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            const withoutPending = prev.filter(
              (m) => !(String(m.id).startsWith('pending-') && m.content === msg.content && m.sender_id === msg.sender_id)
            )
            return [...withoutPending, msg]
          })
          if (msg.offer_id) {
            void supabase
              .from('offers')
              .select('id, status, current_amount, buyer_id, seller_id, listing_id')
              .eq('id', msg.offer_id)
              .maybeSingle()
              .then(({ data: o }) => {
                if (o) {
                  setOffersById((prev) => ({ ...prev, [o.id]: o as OfferRowLite }))
                }
              })
          } else {
            void loadThread()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, supabase, loadThread])

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUserId || !conversation) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)
    stickToBottomRef.current = true

    const tempId = `pending-${Date.now()}`
    const optimisticMessage: Message = {
      id: tempId,
      content,
      sender_id: currentUserId,
      is_read: true,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])

    const result = await sendConversationReply({
      conversation_id: id,
      content,
    })

    if ('error' in result) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } else {
      const inserted = result.message as Message
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? inserted : m))
      )
    }
    setSending(false)
  }

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`
    return format(date, 'MMM d, h:mm a')
  }

  if (!conversation) {
    return (
      <main className="flex min-h-[50vh] flex-1 items-center justify-center bg-gradient-to-b from-muted/40 to-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading conversation" />
      </main>
    )
  }

  const otherUser = conversation.buyer_id === currentUserId ? conversation.seller : conversation.buyer

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-muted/35 to-background">
      <div className="container mx-auto flex min-h-0 max-w-2xl flex-1 flex-col px-4 pb-4 pt-2 sm:px-5 sm:pb-6 sm:pt-3">
        {/* Header */}
        <header className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-background/85 px-2 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:-mx-5 sm:px-3">
          <div className="flex items-center gap-1 sm:gap-2">
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
                {otherUser?.avatar_url ? (
                  <Image
                    src={otherUser.avatar_url || '/placeholder.svg'}
                    alt={otherUser.display_name || ''}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-foreground">
                    {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[17px] font-semibold leading-tight text-foreground">
                    {otherUser?.display_name}
                  </p>
                  {otherUser?.shop_verified && (
                    <span className="shrink-0">
                      <VerifiedBadge size="sm" />
                    </span>
                  )}
                </div>
                {conversation.listing && (
                  <Link
                    href={listingDetailPath(conversation.listing)}
                    className="mt-0.5 block truncate text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {capitalizeWords(conversation.listing?.title)}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Listing Preview */}
        {conversation.listing && (
          <Link
            href={listingDetailPath(conversation.listing)}
            className="mb-4 block overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-colors hover:bg-muted/40 active:bg-muted/55 dark:shadow-none"
          >
            <div className="flex gap-3 p-3">
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-muted">
                {conversation.listing.listing_images?.[0]?.url ? (
                  <Image
                    src={conversation.listing.listing_images[0].url || '/placeholder.svg'}
                    alt={capitalizeWords(conversation.listing?.title)}
                    fill
                    className="object-cover object-center"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-[17px] font-semibold leading-snug text-foreground">
                  {capitalizeWords(conversation.listing?.title)}
                </p>
                <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-foreground">
                  ${conversation.listing.price}
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Messages — bounded scroll window (thread does not grow with the page) */}
        <div
          className={cn(
            'flex shrink-0 flex-col overflow-hidden rounded-[22px] border border-border/50 bg-muted/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-muted/25',
            'h-[min(22rem,42svh)] max-h-[min(26rem,52svh)] sm:h-[min(24rem,38svh)]',
          )}
        >
          <div
            ref={messagesScrollRef}
            className="h-full min-h-0 overflow-y-auto overscroll-contain touch-pan-y"
            aria-label="Message thread"
          >
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center">
                <p className="text-[17px] font-medium text-foreground/90">No messages yet</p>
                <p className="mt-1.5 max-w-[18rem] text-[15px] leading-relaxed text-muted-foreground">
                  Send a message to start the conversation.
                </p>
              </div>
            ) : (
              <div className="flex min-h-full flex-col justify-end gap-2 px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
                {orderedMessages.map((message) => {
                  const isOwn = message.sender_id === currentUserId
                  const offer =
                    message.offer_id && offersById[message.offer_id]
                      ? offersById[message.offer_id]
                      : undefined
                  const isSeller = currentUserId === conversation.seller_id

                  if (offer && message.offer_id) {
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <OfferMessageCard
                          messageContent={message.content}
                          offer={offer}
                          isSeller={isSeller}
                          listingTitle={listingTitleForOffers}
                          listPrice={listPriceNum}
                          minOfferAmount={minOfferAmount}
                          minOfferPct={listingOfferMinPct}
                          createdAt={message.created_at}
                          onThreadRefresh={loadThread}
                        />
                      </div>
                    )
                  }

                  const orderPlaced = parseOrderPlacedMessageMetadata(message.metadata)
                  if (orderPlaced) {
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <OrderPlacedMessageCard
                          payload={orderPlaced}
                          createdAt={message.created_at}
                          viewerIsSeller={isSeller}
                        />
                      </div>
                    )
                  }

                  const negotiationKind = parseOfferNegotiationMessage(message.content)
                  if (negotiationKind) {
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <OfferNegotiationEventCard
                          kind={negotiationKind}
                          content={message.content}
                          createdAt={message.created_at}
                          isOwn={isOwn}
                          showSellerDashboardLink={isSeller && isOwn}
                        />
                      </div>
                    )
                  }

                  if (message.content.trimStart().startsWith('Offer:') && !message.offer_id) {
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <OfferLegacyMirrorCard
                          content={message.content}
                          createdAt={message.created_at}
                        />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={message.id}
                      className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[min(100%,18.5rem)] rounded-[20px] px-3.5 py-2 sm:max-w-[min(100%,20rem)] sm:px-4 sm:py-2.5',
                          isOwn
                            ? 'rounded-br-[6px] bg-foreground text-background shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                            : 'rounded-bl-[6px] border border-border/45 bg-card text-foreground shadow-sm',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.35] tracking-[-0.01em]">
                          {message.content}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-[11px] tabular-nums leading-none',
                            isOwn ? 'text-background/55' : 'text-muted-foreground',
                          )}
                        >
                          {formatMessageDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="mt-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-end gap-2 rounded-[24px] border border-border/70 bg-background/95 px-2 py-1.5 shadow-[0_2px_16px_rgba(17,17,17,0.06)] backdrop-blur-sm dark:border-border/80 dark:bg-card/95 dark:shadow-none"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message"
              className="min-h-touch flex-1 border-0 bg-transparent px-3 text-[17px] shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={sending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !newMessage.trim()}
              className="mb-0.5 h-10 w-10 shrink-0 rounded-full"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" strokeWidth={2} />
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
