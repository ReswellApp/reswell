'use client'

import { useEffect, useState, useRef, useMemo, use, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConversationThreadSkeleton } from '@/components/features/messages/messages-page-skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { ConversationPartyProfile } from '@/components/features/messages/conversation-party-profile'
import { ConversationThreadHeaderChip } from '@/components/features/messages/conversation-thread-header-chip'
import {
  loadOtherPartyProfile,
  type OtherPartyProfileSummary,
} from '@/lib/messages/profile-reviews-loader'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailPath } from '@/lib/listing-query'
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { sendConversationReply, sendConversationLocationReply } from '@/app/actions/messages'
import { MESSAGE_BLOCKED_PHONE_ERROR } from '@/lib/messages/policy-errors'
import { OfferMessageCard } from '@/components/features/messages/offer-message-card'
import {
  OfferLegacyMirrorCard,
  OfferNegotiationEventCard,
} from '@/components/features/messages/offer-negotiation-event-card'
import type { OfferRowLite } from '@/components/features/messages/seller-offer-response-dialog'
import { parseOfferNegotiationMessage } from '@/lib/utils/parse-offer-negotiation-message'
import { parseOrderCompletedMessageMetadata } from '@/lib/validations/order-completed-message-metadata'
import { parseOrderPlacedMessageMetadata } from '@/lib/validations/order-placed-message-metadata'
import { parseReviewRequestMessageMetadata } from '@/lib/validations/review-request-message-metadata'
import {
  composeLocationShareMessageBody,
  messageLocationMetadataSchema,
  parseMessageLocationMetadata,
  type MessageLocationPayload,
} from '@/lib/validations/message-location-metadata'
import { OrderCompletedMessageCard } from '@/components/features/messages/order-completed-message-card'
import { OrderPlacedMessageCard } from '@/components/features/messages/order-placed-message-card'
import { ReviewRequestMessageCard } from '@/components/features/messages/review-request-message-card'
import { MessageLocationCard } from '@/components/features/messages/message-location-card'
import type { GoogleFullPlaceResolved } from '@/components/features/checkout/google-places-address-input'
import { MessageLocationSendPopover } from '@/components/features/messages/message-location-send-popover'
import { LocalPhonePolicyBlockBubble } from '@/components/features/messages/local-phone-policy-block-bubble'
import { MessagesSupportDialog } from '@/components/features/messages/messages-support-dialog'
import { MessageMediaSendButton } from '@/components/features/messages/message-media-send-button'
import { MessageMediaAttachmentCard } from '@/components/features/messages/message-media-attachment-card'
import { MessageSellerOfferButton } from '@/components/features/messages/message-seller-offer-button'
import { parseMarketplaceMessageAttachment } from '@/lib/validations/marketplace-message-attachment'
import { effectiveMinimumOfferPct } from '@/lib/utils/offers-minimum-pct'
import { type ListingThreadOption } from '@/components/features/messages/conversation-listing-switcher'
import { getOtherUserIdFromConversation } from '@/lib/utils/messages-inbox-grouping'
import { resolveThreadPrimaryListingId } from '@/lib/utils/message-thread-active-listing'
import {
  createLocalPhonePolicyBlockMessage,
  mergeServerMessagesPreservingLocalPhoneBlocks,
  parseLocalPhonePolicyBlockMetadata,
} from '@/lib/messages/local-phone-policy-block-message'
import { PromiseDeadlineError, raceWithDeadline } from '@/lib/utils/race-with-deadline'
import { isAbortError } from '@/lib/utils/is-abort-error'

const SEND_SERVER_ACTION_MS = 45_000

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
    slug?: string | null
    listing_images: ListingImageForCard[]
    minimum_offer_pct?: number | null
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
  const [otherPartyProfile, setOtherPartyProfile] =
    useState<OtherPartyProfileSummary | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [offersById, setOffersById] = useState<Record<string, OfferRowLite>>({})
  const [threadListingsById, setThreadListingsById] = useState<
    Record<string, NonNullable<Conversation['listing']>>
  >({})
  const [listingOfferMinPct, setListingOfferMinPct] = useState(70)
  const [listingThreads, setListingThreads] = useState<ListingThreadOption[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [threadLoading, setThreadLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [listingBannerImageReady, setListingBannerImageReady] = useState(false)
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

  const threadPrimaryListingId = useMemo(() => {
    if (conversation?.listing_id) return conversation.listing_id
    return resolveThreadPrimaryListingId(
      orderedMessages,
      offersById,
      conversation?.listing_id ?? null,
    )
  }, [orderedMessages, offersById, conversation?.listing_id])

  const displayListing = useMemo((): Conversation['listing'] | null => {
    if (!conversation) return null
    if (!threadPrimaryListingId) return conversation.listing ?? null
    return (
      threadListingsById[threadPrimaryListingId] ??
      (conversation.listing?.id === threadPrimaryListingId ? conversation.listing : null) ??
      null
    )
  }, [conversation, threadPrimaryListingId, threadListingsById])

  const listPriceNum = useMemo(() => {
    const p = displayListing?.price
    if (p === undefined || p === null) return 0
    const n = typeof p === 'number' ? p : parseFloat(String(p))
    return Math.round(n * 100) / 100
  }, [displayListing?.price])

  const minOfferAmount = useMemo(() => {
    return Math.round(listPriceNum * (listingOfferMinPct / 100) * 100) / 100
  }, [listPriceNum, listingOfferMinPct])

  const listingTitleForOffers = displayListing?.title ?? ''

  const listingChromeLoading = useMemo(
    () =>
      !!conversation &&
      !!threadPrimaryListingId &&
      displayListing == null &&
      conversation.listing?.id !== threadPrimaryListingId,
    [conversation, threadPrimaryListingId, displayListing],
  )

  const threadListingThumbSrc = useMemo(() => {
    if (!displayListing) return ''
    return listingTitleThumbnailSrc(displayListing.listing_images)
  }, [displayListing])

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = messagesScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    stickToBottomRef.current = true
    setThreadLoading(true)
    setConversation(null)
    setMessages([])
    setOffersById({})
    setCurrentUserId(null)
    setThreadListingsById({})
    setListingThreads([])
    setListingBannerImageReady(false)
    setOtherPartyProfile(null)
  }, [id])

  useEffect(() => {
    setListingBannerImageReady(false)
  }, [threadListingThumbSrc])

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

  useEffect(() => {
    if (!displayListing) return
    setListingOfferMinPct(effectiveMinimumOfferPct(displayListing))
  }, [displayListing])

  useEffect(() => {
    if (!threadPrimaryListingId) return
    if (conversation?.listing?.id === threadPrimaryListingId) return

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct')
        .eq('id', threadPrimaryListingId)
        .maybeSingle()
      if (cancelled || error || !data) return
      const row = data as NonNullable<Conversation['listing']>
      setThreadListingsById((prev) => ({ ...prev, [row.id]: row }))
    })()

    return () => {
      cancelled = true
    }
  }, [threadPrimaryListingId, conversation?.listing?.id, supabase])

  useEffect(() => {
    const lid = threadPrimaryListingId
    if (!lid) return

    const channel = supabase
      .channel(`listing-images:${id}:${lid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_images',
          filter: `listing_id=eq.${lid}`,
        },
        () => {
          void supabase
            .from('listings')
            .select(
              'id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct',
            )
            .eq('id', lid)
            .maybeSingle()
            .then(({ data: row, error }) => {
              if (error || !row) return
              const L = row as NonNullable<Conversation['listing']>
              setThreadListingsById((prev) => ({ ...prev, [L.id]: L }))
            })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, threadPrimaryListingId, supabase])

  const loadThread = useCallback(async (isActive: () => boolean = () => true) => {
    try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!isActive()) return
    if (!user) return

    const { data: convData } = await supabase
      .from('conversations')
      .select(`
          *,
          listing:listings(id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct),
          buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, shop_verified),
          seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, shop_verified)
        `)
      .eq('id', id)
      .single()
    if (!isActive()) return

    const nextConv = convData ? (convData as Conversation) : null
    let nextListingThreads: ListingThreadOption[] = []
    const nextThreadListingsPatch: Record<string, NonNullable<Conversation['listing']>> = {}

    if (nextConv) {
      if (nextConv.listing) {
        nextThreadListingsPatch[nextConv.listing.id] = nextConv.listing
      }
      const otherUserId =
        nextConv.buyer_id === user.id ? nextConv.seller_id : nextConv.buyer_id
      void loadOtherPartyProfile(supabase, otherUserId)
        .then((snapshot) => {
          if (!isActive()) return
          setOtherPartyProfile(snapshot)
        })
        .catch(() => {})

      const { data: siblingRows } = await supabase
        .from('conversations')
        .select(`
          id,
          listing_id,
          last_message_at,
          listing:listings(id, title, listing_images(url, thumbnail_url, is_primary)),
          messages(id)
        `)
        .eq('buyer_id', nextConv.buyer_id)
        .eq('seller_id', nextConv.seller_id)
        .order('last_message_at', { ascending: false })
      if (!isActive()) return

      nextListingThreads = (siblingRows ?? [])
        .filter((row) => {
          const messages = (row as { messages?: unknown[] }).messages
          return Array.isArray(messages) && messages.length > 0
        })
        .map((row) => {
          const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing
          return {
            conversationId: row.id as string,
            listingId: (row.listing_id as string | null) ?? null,
            listingTitle: (listing as { title?: string | null } | null)?.title ?? null,
            listingImages:
              (listing as { listing_images?: ListingImageForCard[] | null } | null)?.listing_images ??
              null,
            lastMessageAt: row.last_message_at as string,
          }
        })
    }

    const { data: msgData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    if (!isActive()) return

    const rows = (msgData ?? []) as Message[]

    const offerIds = [...new Set(rows.map((m) => m.offer_id).filter(Boolean))] as string[]
    let offerRows: OfferRowLite[] = []
    const nextOffersById: Record<string, OfferRowLite> = {}
    if (offerIds.length > 0) {
      const { data: orows } = await supabase
        .from('offers')
        .select('id, status, current_amount, initial_amount, buyer_id, seller_id, listing_id, seller_initiated, expires_at, offer_timeline, fulfillment, shipping_amount, line_items')
        .in('id', offerIds)
      if (!isActive()) return
      offerRows = (orows ?? []) as OfferRowLite[]
      for (const o of offerRows) {
        nextOffersById[o.id as string] = o
      }
    }

    const offerListingIds = [
      ...new Set(
        offerRows
          .map((o) => o.listing_id)
          .filter((lid): lid is string => typeof lid === 'string' && lid.length > 0),
      ),
    ]
    if (offerListingIds.length > 0) {
      const { data: listingRows } = await supabase
        .from('listings')
        .select('id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct')
        .in('id', offerListingIds)
      if (!isActive()) return
      for (const row of (listingRows ?? []) as NonNullable<Conversation['listing']>[]) {
        nextThreadListingsPatch[row.id] = row
      }
    }

    if (!isActive()) return

    setCurrentUserId(user.id)
    setConversation(nextConv)
    setListingThreads(nextListingThreads)
    if (Object.keys(nextThreadListingsPatch).length > 0) {
      setThreadListingsById((prev) => ({ ...prev, ...nextThreadListingsPatch }))
    }
    setMessages((prev) => mergeServerMessagesPreservingLocalPhoneBlocks(prev, rows))
    if (Object.keys(nextOffersById).length > 0) {
      setOffersById((prev) => ({ ...prev, ...nextOffersById }))
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

    if (isActive() && typeof window !== 'undefined') {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('unreadCountRefresh')), 150)
    }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error("[messages] loadThread failed:", err)
      }
    } finally {
      if (isActive()) {
        setThreadLoading(false)
      }
    }
  }, [id, supabase])

  useEffect(() => {
    let active = true
    void loadThread(() => active).catch(() => {})

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
            void Promise.resolve(
              supabase
                .from('offers')
                .select('id, status, current_amount, initial_amount, buyer_id, seller_id, listing_id, seller_initiated, expires_at, offer_timeline, fulfillment, shipping_amount, line_items')
                .eq('id', msg.offer_id)
                .maybeSingle()
            ).then(({ data: o }) => {
                if (!active || !o) return
                const offer = o as OfferRowLite
                setOffersById((prev) => ({ ...prev, [offer.id]: offer }))
                const lid = offer.listing_id
                if (lid) {
                  void Promise.resolve(
                    supabase
                      .from('listings')
                      .select('id, title, price, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct')
                      .eq('id', lid)
                      .maybeSingle()
                  ).then(({ data: row }) => {
                      if (!active || !row) return
                      const L = row as NonNullable<Conversation['listing']>
                      setThreadListingsById((prev) => ({ ...prev, [L.id]: L }))
                    })
                    .catch(() => {})
                }
              })
              .catch(() => {})
          } else {
            void loadThread(() => active).catch(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [id, supabase, loadThread])

  const handleSend = async () => {
    const trimmed = newMessage.trim()
    if (!trimmed) return
    if (!currentUserId || !conversation) {
      toast.error('Still loading — try again in a moment.')
      return
    }

    const content = trimmed
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

    try {
      const result = await raceWithDeadline(
        sendConversationReply({
          conversation_id: id,
          content,
        }),
        SEND_SERVER_ACTION_MS,
      )

      if ('error' in result) {
        setMessages((prev) => {
          const withoutPending = prev.filter((m) => m.id !== tempId)
          if (result.error === MESSAGE_BLOCKED_PHONE_ERROR) {
            return [
              ...withoutPending,
              createLocalPhonePolicyBlockMessage({
                senderId: currentUserId,
                originalContent: content,
              }),
            ]
          }
          return withoutPending
        })
        if (result.error !== MESSAGE_BLOCKED_PHONE_ERROR) {
          setNewMessage(content)
          const messageText =
            result.error === 'Unauthorized'
              ? 'Sign in again to send messages.'
              : result.error
          toast.error(messageText)
        }
        return
      }

      const inserted = result.message as Message
      setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m)))
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setNewMessage(content)
      toast.error(
        e instanceof PromiseDeadlineError
          ? 'Message took too long. Check your connection and try again.'
          : 'Failed to send message',
      )
    } finally {
      setSending(false)
    }
  }

  const handleMediaSent = useCallback(
    (inserted: Message) => {
      stickToBottomRef.current = true
      setNewMessage('')
      setMessages((prev) => {
        const withoutDup = prev.filter((m) => m.id !== inserted.id)
        return [...withoutDup, inserted]
      })
    },
    [],
  )

  const sendLocationPin = useCallback(
    async (place: GoogleFullPlaceResolved): Promise<{ ok: boolean }> => {
      if (!currentUserId || !conversation) return { ok: false }

      const formattedAddress = place.formattedAddress.trim()
      if (!formattedAddress) {
        toast.error('Pick a full address from suggestions before sending.')
        return { ok: false }
      }

      let metadata: MessageLocationPayload
      try {
        metadata = messageLocationMetadataSchema.parse({
          kind: 'location_share',
          formattedAddress,
          latitude: place.latitude,
          longitude: place.longitude,
          placeId: place.placeId,
        })
      } catch {
        toast.error('Invalid location data')
        return { ok: false }
      }

      const body = composeLocationShareMessageBody(formattedAddress)
      setSending(true)
      stickToBottomRef.current = true

      const tempId = `pending-${Date.now()}`
      const optimisticMessage: Message = {
        id: tempId,
        content: body,
        sender_id: currentUserId,
        is_read: true,
        created_at: new Date().toISOString(),
        metadata,
      }
      setMessages((prev) => [...prev, optimisticMessage])

      try {
        const result = await raceWithDeadline(
          sendConversationLocationReply({
            conversation_id: id,
            formattedAddress,
            latitude: place.latitude,
            longitude: place.longitude,
            placeId: place.placeId,
          }),
          SEND_SERVER_ACTION_MS,
        )

        if ('error' in result) {
          setMessages((prev) => {
            const withoutPending = prev.filter((m) => m.id !== tempId)
            if (result.error === MESSAGE_BLOCKED_PHONE_ERROR) {
              return [
                ...withoutPending,
                createLocalPhonePolicyBlockMessage({
                  senderId: currentUserId,
                  originalContent: formattedAddress,
                }),
              ]
            }
            return withoutPending
          })
          if (result.error !== MESSAGE_BLOCKED_PHONE_ERROR) {
            toast.error('Failed to send location')
          }
          return { ok: false }
        }

        const inserted = result.message as Message
        setMessages((prev) => prev.map((m) => (m.id === tempId ? inserted : m)))
        return { ok: true }
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        toast.error(
          e instanceof PromiseDeadlineError
            ? 'Location send took too long. Check your connection and try again.'
            : 'Failed to send location',
        )
        return { ok: false }
      } finally {
        setSending(false)
      }
    },
    [conversation, currentUserId, id],
  )

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`
    return format(date, 'MMM d, h:mm a')
  }

  if (threadLoading) {
    return <ConversationThreadSkeleton />
  }

  if (!conversation) {
    return (
      <main className="flex flex-1 flex-col bg-background">
        <div className="container mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-5 md:max-w-4xl lg:max-w-5xl">
          <p className="text-[17px] font-medium text-foreground">Conversation not found</p>
          <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">
            This thread may have been removed or you may not have access.
          </p>
          <Button asChild className="mt-6 rounded-full" variant="outline">
            <Link href="/messages">Back to messages</Link>
          </Button>
        </div>
      </main>
    )
  }

  const otherUser = conversation.buyer_id === currentUserId ? conversation.seller : conversation.buyer
  const otherUserId = getOtherUserIdFromConversation(conversation, currentUserId ?? '')
  const isSellerViewer = currentUserId === conversation.seller_id
  const canMakeSellerOffer =
    isSellerViewer &&
    !!conversation.listing_id &&
    !!displayListing &&
    displayListing.section === 'surfboards'
  const backHref =
    listingThreads.length > 1 ? `/messages/with/${otherUserId}` : '/messages'
  const showListingSwitcher = listingThreads.length > 1

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="container mx-auto flex h-full min-h-0 max-w-2xl flex-1 flex-col overflow-hidden px-4 pb-2 pt-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-6 sm:pt-3 md:max-w-4xl lg:max-w-5xl">
        {/* Header */}
        <header className="relative z-20 shrink-0 -mx-4 mb-2 border-b border-border/60 bg-background px-2 py-2 sm:-mx-5 sm:mb-3 sm:bg-background/85 sm:px-3 sm:backdrop-blur-md supports-[backdrop-filter]:sm:bg-background/70">
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href={backHref} className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-foreground hover:bg-muted/80"
                aria-label="Back to messages"
              >
                <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
              </Button>
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:contents">
              <ConversationPartyProfile
                displayName={otherUser?.display_name ?? ''}
                avatarUrl={otherUser?.avatar_url ?? null}
                shopVerified={!!otherUser?.shop_verified}
                profile={otherPartyProfile}
                pending={!otherUser?.display_name && !otherUser?.avatar_url}
                secondaryLine={
                  displayListing ? (
                    <Link
                      href={listingDetailPath(displayListing)}
                      className={cn(
                        'hidden truncate text-[15px] text-muted-foreground transition-colors hover:text-foreground',
                        showListingSwitcher ? 'md:block' : 'sm:block',
                      )}
                    >
                      {capitalizeWords(displayListing.title)}
                    </Link>
                  ) : listingChromeLoading ? (
                    <p className="hidden truncate text-[15px] text-muted-foreground sm:block">
                      Updating listing…
                    </p>
                  ) : null
                }
              />
              {listingChromeLoading ? (
                <ConversationThreadHeaderChip
                  ariaLabel="Loading listing"
                  thumb={<Skeleton className="h-full w-full rounded-md" />}
                  primary={<Skeleton className="h-3 w-16" />}
                  secondary={<Skeleton className="h-3.5 w-12" />}
                  className="sm:hidden"
                />
              ) : displayListing ? (
                <ConversationThreadHeaderChip
                  href={listingDetailPath(displayListing)}
                  ariaLabel={`View listing: ${capitalizeWords(displayListing.title)}`}
                  thumb={
                    threadListingThumbSrc ? (
                      <>
                        {!listingBannerImageReady ? (
                          <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-md" aria-hidden />
                        ) : null}
                        <Image
                          key={threadListingThumbSrc}
                          src={threadListingThumbSrc}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover object-center"
                          unoptimized={listingImageShouldBypassOptimization(threadListingThumbSrc)}
                          onLoad={() => setListingBannerImageReady(true)}
                        />
                      </>
                    ) : null
                  }
                  primary={capitalizeWords(displayListing.title)}
                  secondary={`$${displayListing.price}`}
                  className="sm:hidden"
                />
              ) : null}
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {listingChromeLoading ? (
          <div
            className={cn(
              'mb-2 hidden gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none sm:mb-4 sm:gap-3 sm:rounded-[18px] sm:p-3',
              showListingSwitcher ? 'md:flex' : 'sm:flex',
            )}
          >
            <Skeleton className="h-14 w-14 shrink-0 rounded-xl sm:h-[72px] sm:w-[72px] sm:rounded-2xl" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 sm:gap-2">
              <Skeleton className="h-4 w-[min(100%,12rem)] sm:h-5 sm:w-[min(100%,14rem)]" />
              <Skeleton className="h-5 w-20 sm:h-6 sm:w-24" />
            </div>
          </div>
        ) : null}
        {displayListing ? (
          <Link
            href={listingDetailPath(displayListing)}
            className={cn(
              'mb-2 hidden overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-colors hover:bg-muted/40 active:bg-muted/55 dark:shadow-none sm:mb-4 sm:rounded-[18px]',
              showListingSwitcher ? 'md:block' : 'sm:block',
            )}
          >
            <div className="flex gap-2 p-2 sm:gap-3 sm:p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-[72px] sm:w-[72px] sm:rounded-2xl">
                {threadListingThumbSrc ? (
                  <>
                    {!listingBannerImageReady ? (
                      <Skeleton
                        className="absolute inset-0 z-10 h-full w-full rounded-xl sm:rounded-2xl"
                        aria-hidden
                      />
                    ) : null}
                    <Image
                      key={threadListingThumbSrc}
                      src={threadListingThumbSrc}
                      alt={capitalizeWords(displayListing.title)}
                      fill
                      sizes="(max-width: 640px) 56px, 72px"
                      className="object-cover object-center"
                      unoptimized={listingImageShouldBypassOptimization(threadListingThumbSrc)}
                      onLoad={() => setListingBannerImageReady(true)}
                    />
                  </>
                ) : null}
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p className="text-[14px] font-semibold leading-snug text-foreground sm:text-[17px]">
                  {capitalizeWords(displayListing.title)}
                </p>
                <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-tight text-foreground sm:mt-1 sm:text-[20px]">
                  ${displayListing.price}
                </p>
              </div>
            </div>
          </Link>
        ) : null}

        {/* Messages — bounded scroll window (thread does not grow with the page) */}
        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-border/50 bg-muted/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-muted/25',
            'sm:max-h-[min(26rem,52svh)] sm:flex-none sm:h-[min(24rem,45svh)] md:h-[min(34rem,52svh)] md:max-h-[min(42rem,68svh)] lg:h-[min(38rem,56svh)] lg:max-h-[min(48rem,72svh)]',
          )}
        >
          <div
            ref={messagesScrollRef}
            className="h-full min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
            aria-label="Message thread"
          >
            {!threadLoading && messages.length === 0 ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center">
                <p className="text-[17px] font-medium text-foreground/90">No messages yet</p>
                <p className="mt-1.5 max-w-[18rem] text-[15px] leading-relaxed text-muted-foreground">
                  Send a message to start the conversation.
                </p>
              </div>
            ) : (
              <div className="flex min-h-full flex-col justify-end gap-2 px-3 pb-14 pt-4 sm:px-4 sm:pb-16 sm:pt-4">
                {orderedMessages.map((message) => {
                  const isOwn = message.sender_id === currentUserId
                  const offer =
                    message.offer_id && offersById[message.offer_id]
                      ? offersById[message.offer_id]
                      : undefined
                  const isSeller = currentUserId === conversation.seller_id

                  const phoneBlock = parseLocalPhonePolicyBlockMetadata(message.metadata)
                  if (phoneBlock && isOwn) {
                    return (
                      <LocalPhonePolicyBlockBubble
                        key={message.id}
                        originalContent={phoneBlock.originalContent}
                        formattedTime={formatMessageDate(message.created_at)}
                        relatedConversationId={id}
                      />
                    )
                  }

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

                  if (message.offer_id && message.content.trim()) {
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

                  const orderCompleted = parseOrderCompletedMessageMetadata(message.metadata)
                  if (orderCompleted) {
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <OrderCompletedMessageCard
                          payload={orderCompleted}
                          createdAt={message.created_at}
                          viewerIsSeller={isSeller}
                        />
                      </div>
                    )
                  }

                  const reviewRequested = parseReviewRequestMessageMetadata(message.metadata)
                  if (reviewRequested) {
                    const viewerIsBuyer = currentUserId === conversation.buyer_id
                    const sellerDisplayName =
                      conversation.seller.display_name?.trim() || 'Seller'
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <ReviewRequestMessageCard
                          payload={reviewRequested}
                          createdAt={message.created_at}
                          viewerIsBuyer={viewerIsBuyer}
                          sellerDisplayName={sellerDisplayName}
                          onAfterReviewSubmitted={loadThread}
                        />
                      </div>
                    )
                  }

                  const locationPin = parseMessageLocationMetadata(message.metadata)
                  if (locationPin) {
                    const locationThumbSrc =
                      listingTitleThumbnailSrc(displayListing?.listing_images ?? null) || null
                    const locationThumbAlt =
                      (displayListing?.title ? capitalizeWords(displayListing.title) : '') || 'Listing'
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <MessageLocationCard
                          payload={locationPin}
                          formattedTime={formatMessageDate(message.created_at)}
                          listingThumbnailSrc={locationThumbSrc}
                          listingImageAlt={locationThumbAlt}
                          listingThumbnailPending={listingChromeLoading}
                        />
                      </div>
                    )
                  }

                  const mediaAtt = parseMarketplaceMessageAttachment(message.metadata)
                  if (mediaAtt) {
                    return (
                      <div
                        key={message.id}
                        className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                      >
                        <MessageMediaAttachmentCard
                          messageId={message.id}
                          metadata={message.metadata}
                          content={message.content}
                          isOwn={isOwn}
                          formattedTime={formatMessageDate(message.created_at)}
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
                          'max-w-[min(100%,18.5rem)] rounded-[20px] px-3.5 py-2 sm:max-w-[min(100%,20rem)] sm:px-4 sm:py-2.5 md:max-w-[min(100%,28rem)]',
                          isOwn
                            ? 'rounded-br-[6px] bg-listingHeart text-white shadow-[0_1px_2px_rgba(53,81,133,0.22)]'
                            : 'rounded-bl-[6px] border border-border/45 bg-card text-foreground shadow-sm',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words text-[17px] leading-[1.35] tracking-[-0.01em]">
                          {message.content}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-[11px] tabular-nums leading-none',
                            isOwn ? 'text-white/55' : 'text-muted-foreground',
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
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 sm:bottom-4 sm:right-4">
            <MessagesSupportDialog
              relatedConversationId={id}
              triggerMode="floating"
              floatingTriggerClassName="pointer-events-auto"
            />
          </div>
        </div>

        <div className="relative z-10 mt-1 shrink-0 sm:mt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSend()
            }}
            className="flex items-end gap-2 rounded-[24px] border border-border/70 bg-background/95 px-2 py-1.5 shadow-[0_2px_16px_rgba(17,17,17,0.06)] backdrop-blur-sm dark:border-border/80 dark:bg-card/95 dark:shadow-none"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message"
              disabled={sending}
              autoComplete="off"
              aria-label="Message text"
              className="min-h-touch min-w-0 flex-1 border-0 bg-transparent px-3 text-[17px] shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <MessageMediaSendButton
              conversationId={id}
              disabled={sending || !currentUserId || !conversation}
              caption={newMessage}
              onSent={handleMediaSent}
              onBlockedPhone={(originalContent) => {
                if (!currentUserId) return
                setMessages((prev) => [
                  ...prev,
                  createLocalPhonePolicyBlockMessage({
                    senderId: currentUserId,
                    originalContent,
                  }),
                ])
                setNewMessage('')
              }}
            />
            {canMakeSellerOffer && conversation.listing_id ? (
              <MessageSellerOfferButton
                conversationId={id}
                listingId={conversation.listing_id}
                buyerUserId={conversation.buyer_id}
                sellerUserId={conversation.seller_id}
                listingTitle={displayListing?.title ?? ''}
                listPrice={listPriceNum}
                primaryImageUrl={threadListingThumbSrc || null}
                disabled={sending}
                onOfferSent={loadThread}
              />
            ) : null}
            <MessageLocationSendPopover
              disabled={sending || !currentUserId || !conversation}
              onSend={sendLocationPin}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !newMessage.trim()}
              className={cn(
                'mb-0.5 h-10 w-10 shrink-0 rounded-full',
                'bg-listingHeart text-white shadow-sm hover:bg-[#2a4170]',
                'dark:bg-listingHeart dark:text-white dark:hover:bg-[#2a4170]',
                'focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-listingHeart',
              )}
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
      </div>
    </main>
  )
}
