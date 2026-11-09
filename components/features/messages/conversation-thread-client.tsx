'use client'

import { Fragment, useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MessageComposerBar } from '@/components/features/messages/message-composer-bar'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MessageThreadMobileComposerDock } from '@/components/features/messages/message-thread-mobile-composer-dock'
import { ConversationPartyProfile } from '@/components/features/messages/conversation-party-profile'
import { ConversationThreadHeaderChip } from '@/components/features/messages/conversation-thread-header-chip'
import { type OtherPartyProfileSummary } from '@/lib/messages/profile-reviews-loader'
import {
  formatMessageTooltipTimestamp,
  formatThreadGroupTimestamp,
} from '@/lib/utils/message-display-time'
import {
  messageBubbleGroup,
  shouldBreakMessageGroup,
} from '@/lib/utils/message-thread-grouping'
import { MessageTextBubble, messageThreadCanvasClassName } from '@/components/features/messages/message-text-bubble'
import { helpHubHref } from '@/lib/help/help-hub-intents'
import { RelativeTime } from '@/components/ui/relative-time'
import { toast } from 'sonner'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailPath } from '@/lib/listing-query'
import { listingTitleThumbnailSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  sendConversationReply,
  loadConversationThread,
  markConversationThreadRead,
  type ConversationThreadData,
} from '@/app/actions/messages'
import {
  dispatchConversationInboxActivity,
  dispatchConversationThreadOpened,
  dispatchMessagesInboxRefresh,
  dispatchUnreadCountRefresh,
  dispatchUnreadMessageCountAdjust,
} from '@/lib/utils/unread-message-count-events'
import { getPolicyBlockFromSendResult } from '@/lib/messages/policy-block-client'
import { isMessageSendRestrictionResult } from '@/lib/messages/send-restriction-errors'
import {
  createLocalPolicyBlockMessage,
  mergeServerMessagesPreservingLocalPolicyBlocks,
  parseLocalPolicyBlockMetadata,
  PENDING_THREAD_MESSAGE_ID_PREFIX,
  replaceMatchingPendingThreadMessage,
} from '@/lib/messages/local-phone-policy-block-message'
import {
  useConversationThreadLive,
  type RealtimeThreadMessage,
} from '@/components/features/messages/hooks/use-conversation-thread-live'
import { OfferMessageCard } from '@/components/features/messages/offer-message-card'
import {
  OfferLegacyMirrorCard,
  OfferNegotiationEventCard,
} from '@/components/features/messages/offer-negotiation-event-card'
import type { OfferRowLite } from '@/components/features/messages/seller-offer-response-dialog'
import {
  parseOfferNegotiationMessage,
  resolveActionableCounteredOffer,
  resolveAcceptedOfferForCheckout,
  resolveNegotiationOffer,
} from '@/lib/utils/parse-offer-negotiation-message'
import { dashboardOffersPath } from '@/lib/utils/offers-dashboard-display'
import { parseOfferLineItems } from '@/lib/types/offer-line-item'
import { parseOrderCompletedMessageMetadata } from '@/lib/validations/order-completed-message-metadata'
import { parseOrderPlacedMessageMetadata } from '@/lib/validations/order-placed-message-metadata'
import { parseOrderRefundedMessageMetadata } from '@/lib/validations/order-refunded-message-metadata'
import { parseOrderExclusiveRepurchaseMessageMetadata } from '@/lib/validations/order-exclusive-repurchase-message-metadata'
import { parseReviewRequestMessageMetadata } from '@/lib/validations/review-request-message-metadata'
import { parseMessageLocationMetadata } from '@/lib/validations/message-location-metadata'
import { parseShippingLabelThreadMessage } from '@/lib/messages/shipping-label-thread'
import { parseOrderShippedThreadMessage } from '@/lib/messages/order-shipped-thread'
import { OrderCompletedMessageCard } from '@/components/features/messages/order-completed-message-card'
import { OrderPlacedMessageCard } from '@/components/features/messages/order-placed-message-card'
import { OrderRefundedMessageCard } from '@/components/features/messages/order-refunded-message-card'
import { OrderShippedMessageCard } from '@/components/features/messages/order-shipped-message-card'
import { ShippingLabelMessageCard } from '@/components/features/messages/shipping-label-message-card'
import { OrderExclusiveRepurchaseMessageCard } from '@/components/features/messages/order-exclusive-repurchase-message-card'
import { ReviewRequestMessageCard } from '@/components/features/messages/review-request-message-card'
import { MessageLocationCard } from '@/components/features/messages/message-location-card'
import { LocalPhonePolicyBlockBubble } from '@/components/features/messages/local-phone-policy-block-bubble'
import { MessageMediaAttachmentCard } from '@/components/features/messages/message-media-attachment-card'
import {
  SupportCaseOpenedCard,
  SupportCaseStatusCard,
} from '@/components/features/support/support-case-system-card'
import { parseSupportThreadSystemMessage } from '@/lib/messages/parse-support-thread-message'
import {
  MessageMediaImageLightbox,
  type MessageMediaImageLightboxItem,
} from '@/components/features/messages/message-media-image-lightbox'
import { MessageSellerOfferButton } from '@/components/features/messages/message-seller-offer-button'
import {
  parseMarketplaceMessageAttachment,
  parseMarketplaceMessageImageAttachment,
} from '@/lib/validations/marketplace-message-attachment'
import { isPeerListingSection } from '@/lib/peer-listing-sections'
import { listingStatusAcceptsOffers } from '@/lib/utils/listing-offer-eligibility'
import { effectiveMinimumOfferPct } from '@/lib/utils/offers-minimum-pct'
import { type ListingThreadOption } from '@/components/features/messages/conversation-listing-switcher'
import { getOtherUserIdFromConversation } from '@/lib/utils/messages-inbox-grouping'
import { offerMessageAnchorId } from '@/lib/utils/offer-messages-href'
import { resolveThreadPrimaryListingId } from '@/lib/utils/message-thread-active-listing'
import { raceWithDeadline } from '@/lib/utils/race-with-deadline'
import { isAbortError } from '@/lib/utils/is-abort-error'
import { useComposerUnlock } from '@/hooks/use-composer-unlock'
import { COMPOSER_UNLOCK_DENIED_ERROR } from '@/lib/messages/composer-unlock-errors'

const SEND_SERVER_ACTION_MS = 45_000

interface Message {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
  offer_id?: string | null
  metadata?: unknown | null
  sendStatus?: 'sending' | 'failed'
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
    status?: string | null
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

type ListingRow = NonNullable<Conversation['listing']>

function buildListingMap(
  data: ConversationThreadData,
): Record<string, ListingRow> {
  const map: Record<string, ListingRow> = {}
  const conv = data.conversation as Conversation | null
  if (conv?.listing) map[conv.listing.id] = conv.listing
  for (const row of (data.threadListings as ListingRow[]) ?? []) {
    if (row?.id) map[row.id] = row
  }
  return map
}

function buildOffersMap(data: ConversationThreadData): Record<string, OfferRowLite> {
  const map: Record<string, OfferRowLite> = {}
  for (const o of (data.offers as unknown as OfferRowLite[]) ?? []) {
    if (o?.id) map[o.id] = o
  }
  return map
}

export interface ConversationThreadClientProps {
  conversationId: string
  initialData: ConversationThreadData
  embedded?: boolean
  /** Hide the marketplace thread header (use when a parent already provides chrome). */
  hideHeader?: boolean
  backHref?: string
}

export function ConversationThreadClient({
  conversationId: id,
  initialData,
  embedded = false,
  hideHeader = false,
  backHref: backHrefProp,
}: ConversationThreadClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(
    () => (initialData.conversation as Conversation | null) ?? null,
  )
  const [otherPartyProfile, setOtherPartyProfile] =
    useState<OtherPartyProfileSummary | null>(() => initialData.otherPartyProfile)
  const [messages, setMessages] = useState<Message[]>(
    () => (initialData.messages as unknown as Message[]) ?? [],
  )
  const [hiddenShippingLabelOrderIds, setHiddenShippingLabelOrderIds] = useState(
    () => new Set(initialData.hiddenShippingLabelOrderIds ?? []),
  )
  const [offersById, setOffersById] = useState<Record<string, OfferRowLite>>(() =>
    buildOffersMap(initialData),
  )
  const [threadListingsById, setThreadListingsById] = useState<
    Record<string, ListingRow>
  >(() => buildListingMap(initialData))
  const [listingOfferMinPct, setListingOfferMinPct] = useState(70)
  const [listingThreads, setListingThreads] = useState<ListingThreadOption[]>(
    () => (initialData.listingThreads as ListingThreadOption[]) ?? [],
  )
  const [newMessage, setNewMessage] = useState('')
  const newMessageRef = useRef('')
  newMessageRef.current = newMessage
  const inFlightSendIdsRef = useRef(new Set<string>())
  const composerUnlock = useComposerUnlock({ scope: 'marketplace' })
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => initialData.currentUserId ?? null,
  )
  const unreadAdjustRef = useRef(0)
  const knownMessageIdsRef = useRef(new Set<string>())
  const [listingBannerImageReady, setListingBannerImageReady] = useState(false)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const programmaticScrollRef = useRef(false)
  const supabase = createClient()

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  )

  const threadImageGallery = useMemo((): Array<MessageMediaImageLightboxItem & { messageId: string }> => {
    const items: Array<MessageMediaImageLightboxItem & { messageId: string }> = []
    for (const message of orderedMessages) {
      const imageAtt = parseMarketplaceMessageImageAttachment(message.metadata)
      if (!imageAtt) continue
      items.push({
        messageId: message.id,
        src: `/api/messages/${message.id}/attachment`,
        title: imageAtt.file_name,
      })
    }
    return items
  }, [orderedMessages])

  const [threadImageLightboxOpen, setThreadImageLightboxOpen] = useState(false)
  const [threadImageLightboxIndex, setThreadImageLightboxIndex] = useState(0)

  const openThreadImage = useCallback(
    (messageId: string) => {
      const nextIndex = threadImageGallery.findIndex((item) => item.messageId === messageId)
      if (nextIndex < 0) return
      setThreadImageLightboxIndex(nextIndex)
      setThreadImageLightboxOpen(true)
    },
    [threadImageGallery],
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
    programmaticScrollRef.current = true
    if (behavior === 'auto') {
      el.scrollTop = el.scrollHeight
      programmaticScrollRef.current = false
      return
    }
    el.scrollTo({ top: el.scrollHeight, behavior })
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false
    })
  }, [])

  const [offerHashId, setOfferHashId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const hash = window.location.hash
    const hashId = hash.startsWith('#offer-') ? hash.slice(1) : null
    setOfferHashId(hashId)
    if (hashId) {
      stickToBottomRef.current = false
      return
    }
    scrollThreadToBottom('auto')
  }, [id, scrollThreadToBottom])

  useEffect(() => {
    setListingBannerImageReady(false)
  }, [threadListingThumbSrc])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const onScroll = () => {
      if (programmaticScrollRef.current) return
      const thresholdPx = 72
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottomRef.current = distanceFromBottom < thresholdPx
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [conversation])

  useLayoutEffect(() => {
    if (offerHashId) {
      stickToBottomRef.current = false
      return
    }
    if (!stickToBottomRef.current) return
    // Snap before paint. A smooth scroll fires mid-flight scroll events that
    // clear stick-to-bottom, so the new bubble stays below the fold until refresh.
    scrollThreadToBottom('auto')
  }, [offerHashId, orderedMessages, scrollThreadToBottom])

  useEffect(() => {
    if (!offerHashId) return
    const el = document.getElementById(offerHashId)
    if (!el) return
    stickToBottomRef.current = false
    el.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [offerHashId, orderedMessages, offersById])

  useEffect(() => {
    if (!displayListing) return
    setListingOfferMinPct(effectiveMinimumOfferPct(displayListing))
  }, [displayListing])

  // Mark the thread read after first paint — fire-and-forget so opening the
  // thread is a pure read and never blocks on the write/revalidation.
  useEffect(() => {
    let active = true
    const unreadInbound = initialData.unreadInboundCount ?? 0
    // Clear header badge + inbox row immediately (don't wait on the server write).
    dispatchConversationThreadOpened(id, unreadInbound)
    if (unreadInbound > 0) {
      unreadAdjustRef.current = unreadInbound
      dispatchUnreadMessageCountAdjust(-unreadInbound)
    }

    void markConversationThreadRead(id)
      .then(() => {
        if (!active || typeof window === 'undefined') return
        dispatchUnreadCountRefresh()
        dispatchMessagesInboxRefresh()
      })
      .catch(() => {
        if (!active || unreadAdjustRef.current <= 0) return
        dispatchUnreadMessageCountAdjust(unreadAdjustRef.current)
        unreadAdjustRef.current = 0
      })

    return () => {
      active = false
    }
  }, [id, initialData.unreadInboundCount])

  useEffect(() => {
    if (!threadPrimaryListingId) return
    if (conversation?.listing?.id === threadPrimaryListingId) return
    if (threadListingsById[threadPrimaryListingId]) return

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, price, status, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct')
        .eq('id', threadPrimaryListingId)
        .maybeSingle()
      if (cancelled || error || !data) return
      const row = data as ListingRow
      setThreadListingsById((prev) => ({ ...prev, [row.id]: row }))
    })()

    return () => {
      cancelled = true
    }
  }, [threadPrimaryListingId, conversation?.listing?.id, threadListingsById, supabase])

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
              'id, title, price, status, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct',
            )
            .eq('id', lid)
            .maybeSingle()
            .then(({ data: row, error }) => {
              if (error || !row) return
              const L = row as ListingRow
              setThreadListingsById((prev) => ({ ...prev, [L.id]: L }))
            })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, threadPrimaryListingId, supabase])

  const loadThread = useCallback(async (isActive: () => boolean = () => true): Promise<Message[] | null> => {
    try {
      const result = await loadConversationThread(id)
      if (!isActive()) return null
      if ('error' in result) return null

      const nextConv = (result.conversation as Conversation | null) ?? null
      const nextThreadListingsPatch: Record<string, ListingRow> = {}

      if (nextConv?.listing) {
        nextThreadListingsPatch[nextConv.listing.id] = nextConv.listing
      }
      for (const row of result.threadListings as ListingRow[]) {
        nextThreadListingsPatch[row.id] = row
      }

      const nextOffersById: Record<string, OfferRowLite> = {}
      for (const o of result.offers as unknown as OfferRowLite[]) {
        nextOffersById[o.id as string] = o
      }

      const rows = result.messages as unknown as Message[]

      setHiddenShippingLabelOrderIds(new Set(result.hiddenShippingLabelOrderIds ?? []))
      setOtherPartyProfile(result.otherPartyProfile)
      setCurrentUserId(result.currentUserId)
      setConversation(nextConv)
      setListingThreads(result.listingThreads as ListingThreadOption[])
      if (Object.keys(nextThreadListingsPatch).length > 0) {
        setThreadListingsById((prev) => ({ ...prev, ...nextThreadListingsPatch }))
      }
      setMessages((prev) => mergeServerMessagesPreservingLocalPolicyBlocks(prev, rows))
      if (Object.keys(nextOffersById).length > 0) {
        setOffersById((prev) => ({ ...prev, ...nextOffersById }))
      }
      return rows
    } catch (err) {
      if (!isAbortError(err)) {
        console.error("[messages] loadThread failed:", err)
      }
      return null
    }
  }, [id])

  const refreshThread = useCallback(() => {
    void loadThread()
  }, [loadThread])

  const fetchOfferForMessage = useCallback(
    (offerId: string, isActive: () => boolean) => {
      void Promise.resolve(
        supabase
          .from('offers')
          .select('id, status, current_amount, initial_amount, buyer_id, seller_id, listing_id, seller_initiated, expires_at, offer_timeline, fulfillment, shipping_amount, line_items, payment_intent_id')
          .eq('id', offerId)
          .maybeSingle(),
      )
        .then(({ data: o }) => {
          if (!isActive() || !o) return
          const offer = o as OfferRowLite
          setOffersById((prev) => ({ ...prev, [offer.id]: offer }))
          const lid = offer.listing_id
          if (lid) {
            void Promise.resolve(
              supabase
                .from('listings')
                .select('id, title, price, status, section, slug, listing_images(url, thumbnail_url, is_primary), minimum_offer_pct')
                .eq('id', lid)
                .maybeSingle(),
            )
              .then(({ data: row }) => {
                if (!isActive() || !row) return
                const L = row as ListingRow
                setThreadListingsById((prev) => ({ ...prev, [L.id]: L }))
              })
              .catch(() => {})
          }
        })
        .catch(() => {})
    },
    [supabase],
  )

  const threadGenerationRef = useRef(0)
  useEffect(() => {
    return () => {
      threadGenerationRef.current += 1
    }
  }, [id])

  const syncOpenThread = useCallback(() => {
    const generation = threadGenerationRef.current
    void loadThread(() => threadGenerationRef.current === generation).then((rows) => {
      if (threadGenerationRef.current !== generation || !rows || !currentUserId) return
      const unreadInbound = rows.reduce(
        (count, message) =>
          count + (!message.is_read && message.sender_id !== currentUserId ? 1 : 0),
        0,
      )
      if (unreadInbound <= 0) return
      dispatchConversationThreadOpened(id, unreadInbound)
      void markConversationThreadRead(id)
        .then(() => {
          dispatchUnreadCountRefresh()
          dispatchMessagesInboxRefresh()
        })
        .catch(() => {})
    })
  }, [currentUserId, id, loadThread])

  for (const message of messages) {
    knownMessageIdsRef.current.add(message.id)
  }

  const applyInsertedMessage = useCallback(
    (incoming: RealtimeThreadMessage) => {
      if (knownMessageIdsRef.current.has(incoming.id)) return
      knownMessageIdsRef.current.add(incoming.id)
      const msg: Message = {
        id: incoming.id,
        content: incoming.content,
        sender_id: incoming.sender_id,
        created_at: incoming.created_at,
        is_read: incoming.is_read ?? false,
        offer_id: incoming.offer_id ?? null,
        metadata: incoming.metadata ?? null,
      }
      const generation = threadGenerationRef.current
      const isCurrentThread = () => threadGenerationRef.current === generation
      const viewerIsSeller = Boolean(
        currentUserId && conversation?.seller_id === currentUserId,
      )
      const hideSellerLabelPayload =
        viewerIsSeller && parseShippingLabelThreadMessage(msg.content, msg.metadata)
      if (hideSellerLabelPayload) {
        void loadThread(isCurrentThread)
      } else {
        stickToBottomRef.current = true
        setMessages((prev) => replaceMatchingPendingThreadMessage(prev, msg))
        if (msg.offer_id) {
          fetchOfferForMessage(msg.offer_id, isCurrentThread)
        }
      }
      dispatchConversationInboxActivity({
        conversationId: id,
        at: msg.created_at,
        message: {
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          created_at: msg.created_at,
          is_read: true,
          metadata: msg.metadata,
        },
      })
      if (currentUserId && msg.sender_id !== currentUserId) {
        // Viewing this thread — clear badge/inbox for the inbound message
        // immediately so the ticker never flashes while mark-read runs.
        dispatchConversationThreadOpened(id, 1)
        dispatchUnreadMessageCountAdjust(-1)
        void markConversationThreadRead(id)
          .then(() => {
            dispatchUnreadCountRefresh()
            dispatchMessagesInboxRefresh()
          })
          .catch(() => {
            dispatchUnreadMessageCountAdjust(1)
          })
      }
    },
    [conversation?.seller_id, currentUserId, fetchOfferForMessage, id, loadThread],
  )

  const applyUpdatedMessage = useCallback((incoming: RealtimeThreadMessage) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === incoming.id
          ? {
              ...message,
              is_read: incoming.is_read ?? message.is_read,
              content: incoming.content || message.content,
              metadata: incoming.metadata ?? message.metadata,
            }
          : message,
      ),
    )
  }, [])

  useConversationThreadLive({
    conversationId: id,
    onMessageInsert: applyInsertedMessage,
    onMessageUpdate: applyUpdatedMessage,
    onThreadChanged: syncOpenThread,
  })

  const restoreComposerIfEmpty = useCallback((content: string) => {
    if (newMessageRef.current.trim()) return
    newMessageRef.current = content
    setNewMessage(content)
  }, [])

  const sendThreadText = useCallback(
    async (content: string, existingTempId?: string) => {
      if (!currentUserId) {
        toast.error('Still loading — try again in a moment.')
        return
      }
      if (existingTempId && inFlightSendIdsRef.current.has(existingTempId)) return

      const unlockToken = await composerUnlock.ensure()
      if (!unlockToken) {
        toast.error(COMPOSER_UNLOCK_DENIED_ERROR)
        if (!existingTempId) restoreComposerIfEmpty(content)
        return
      }

      const tempId = existingTempId ?? `${PENDING_THREAD_MESSAGE_ID_PREFIX}${crypto.randomUUID()}`
      inFlightSendIdsRef.current.add(tempId)
      stickToBottomRef.current = true

      if (existingTempId) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId ? { ...message, sendStatus: 'sending' } : message,
          ),
        )
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: tempId,
            content,
            sender_id: currentUserId,
            is_read: false,
            created_at: new Date().toISOString(),
            sendStatus: 'sending',
          },
        ])
      }

      try {
        const result = await raceWithDeadline(
          sendConversationReply({
            conversation_id: id,
            content,
            composer_unlock_token: unlockToken,
          }),
          SEND_SERVER_ACTION_MS,
        )

        if ('error' in result) {
          const policyReason = getPolicyBlockFromSendResult(result)
          if (policyReason) {
            setMessages((prev) => [
              ...prev.filter((message) => message.id !== tempId),
              createLocalPolicyBlockMessage({
                senderId: currentUserId,
                originalContent: content,
                reasonCode: policyReason,
              }),
            ])
            return
          }
          if (
            isMessageSendRestrictionResult(result) ||
            result.error === 'Unauthorized' ||
            result.error === 'Forbidden'
          ) {
            setMessages((prev) => prev.filter((message) => message.id !== tempId))
            restoreComposerIfEmpty(content)
            toast.error(
              result.error === 'Unauthorized' ? 'Sign in again to send messages.' : result.error,
            )
            return
          }
          setMessages((prev) =>
            prev.map((message) =>
              message.id === tempId ? { ...message, sendStatus: 'failed' } : message,
            ),
          )
          return
        }

        const inserted = result.message as Message
        knownMessageIdsRef.current.add(inserted.id)
        setMessages((prev) =>
          prev.map((message) => (message.id === tempId ? inserted : message)),
        )
        dispatchConversationInboxActivity({
          conversationId: id,
          at: inserted.created_at,
          message: {
            id: inserted.id,
            content: inserted.content,
            sender_id: inserted.sender_id,
            created_at: inserted.created_at,
            is_read: true,
            metadata: inserted.metadata,
          },
        })
      } catch {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId ? { ...message, sendStatus: 'failed' } : message,
          ),
        )
      } finally {
        inFlightSendIdsRef.current.delete(tempId)
      }
    },
    [composerUnlock.ensure, currentUserId, id, restoreComposerIfEmpty],
  )

  const handleSend = () => {
    const trimmed = newMessageRef.current.trim()
    if (!trimmed) return
    if (!currentUserId || !conversation) {
      toast.error('Still loading — try again in a moment.')
      return
    }
    newMessageRef.current = ''
    setNewMessage('')
    void sendThreadText(trimmed)
  }

  const handleMediaSent = useCallback(
    (inserted: Message) => {
      stickToBottomRef.current = true
      setNewMessage('')
      setMessages((prev) => {
        const withoutDup = prev.filter((m) => m.id !== inserted.id)
        return [...withoutDup, inserted]
      })
      dispatchConversationInboxActivity({
        conversationId: id,
        at: inserted.created_at,
        message: {
          id: inserted.id,
          content: inserted.content,
          sender_id: inserted.sender_id,
          created_at: inserted.created_at,
          is_read: true,
          metadata: inserted.metadata,
        },
      })
    },
    [id],
  )

  const threadTime = (iso: string) => (
    <RelativeTime iso={iso} formatLabel={formatThreadGroupTimestamp} />
  )

  const lastThreadMessage = orderedMessages.at(-1)
  const lastOwnReceipt =
    lastThreadMessage && currentUserId && lastThreadMessage.sender_id === currentUserId
      ? lastThreadMessage.sendStatus === 'failed'
        ? null
        : lastThreadMessage.sendStatus === 'sending' ||
            lastThreadMessage.id.startsWith(PENDING_THREAD_MESSAGE_ID_PREFIX)
          ? 'Sending'
          : lastThreadMessage.is_read
            ? 'Read'
            : 'Delivered'
      : null

  // True only for ordinary text bubbles — every special card (offer, order,
  // review, location, media, negotiation, policy block) breaks a bubble run so
  // grouping/corner-stacking only applies between consecutive plain messages.
  const isPlainTextMessage = useCallback(
    (m: Message): boolean => {
      const own = m.sender_id === currentUserId
      if (parseLocalPolicyBlockMetadata(m.metadata) && own) return false
      if (m.offer_id && offersById[m.offer_id]) return false
      if (m.offer_id && m.content.trim()) return false
      if (parseOrderPlacedMessageMetadata(m.metadata)) return false
      if (parseOrderCompletedMessageMetadata(m.metadata)) return false
      if (parseOrderRefundedMessageMetadata(m.metadata)) return false
      if (parseOrderExclusiveRepurchaseMessageMetadata(m.metadata)) return false
      if (parseShippingLabelThreadMessage(m.content, m.metadata)) return false
      if (parseOrderShippedThreadMessage(m.content, m.metadata)) return false
      if (parseReviewRequestMessageMetadata(m.metadata)) return false
      if (parseMessageLocationMetadata(m.metadata)) return false
      if (parseMarketplaceMessageAttachment(m.metadata)) return false
      if (parseOfferNegotiationMessage(m.content)) return false
      if (m.content.trimStart().startsWith('Offer:') && !m.offer_id) return false
      if (parseSupportThreadSystemMessage(m.content)) return false
      return true
    },
    [currentUserId, offersById],
  )

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
  const hasMultipleListingThreads = listingThreads.length > 1
  const backHref =
    backHrefProp ??
    (hasMultipleListingThreads ? `/messages/with/${otherUserId}` : '/messages')
  // Inbox stays visible on desktop, so hide Back unless this person has more
  // than one listing thread — then Back returns to that listing list.
  const hideEmbeddedDesktopBack = embedded && !hasMultipleListingThreads
  const backAriaLabel = hasMultipleListingThreads
    ? 'Back to listing conversations'
    : 'Back to messages'
  const isSellerViewer = !!currentUserId && currentUserId === conversation.seller_id
  const sellerOfferListing = displayListing ?? conversation.listing
  const sellerOfferListingId = sellerOfferListing?.id ?? conversation.listing_id
  const sellerOfferListingStatusOk =
    sellerOfferListing?.status == null ||
    listingStatusAcceptsOffers(sellerOfferListing.status)
  const canMakeSellerOffer =
    isSellerViewer &&
    !!sellerOfferListingId &&
    sellerOfferListingStatusOk &&
    (!sellerOfferListing?.section || isPeerListingSection(sellerOfferListing.section))

  return (
    <main
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-background",
        embedded ? "overflow-hidden" : "h-full overflow-hidden",
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {!hideHeader ? (
        <header className="relative z-20 shrink-0 border-b border-border/60 bg-background/90 px-2 py-1.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:px-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href={backHref}
              className={cn("shrink-0", hideEmbeddedDesktopBack && "lg:hidden")}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-foreground hover:bg-muted/80"
                aria-label={backAriaLabel}
              >
                <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
              </Button>
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <ConversationPartyProfile
                displayName={otherUser?.display_name ?? ''}
                avatarUrl={otherUser?.avatar_url ?? null}
                shopVerified={!!otherUser?.shop_verified}
                profile={otherPartyProfile}
                pending={!otherUser?.display_name && !otherUser?.avatar_url}
              />
              {listingChromeLoading ? (
                <ConversationThreadHeaderChip
                  ariaLabel="Loading listing"
                  thumb={<span className="block h-full w-full animate-pulse rounded-md bg-muted" />}
                  primary={<span className="block h-3 w-16 animate-pulse rounded bg-muted" />}
                  secondary={<span className="block h-3.5 w-12 animate-pulse rounded bg-muted" />}
                  className="ml-auto max-w-[11rem]"
                />
              ) : displayListing ? (
                <ConversationThreadHeaderChip
                  href={listingDetailPath(displayListing)}
                  ariaLabel={`View listing: ${capitalizeWords(displayListing.title)}`}
                  thumb={
                    threadListingThumbSrc ? (
                      <>
                        {!listingBannerImageReady ? (
                          <span className="absolute inset-0 z-10 block h-full w-full animate-pulse rounded-md bg-muted" aria-hidden />
                        ) : null}
                        <Image
                          key={threadListingThumbSrc}
                          src={threadListingThumbSrc}
                          alt=""
                          fill
                          sizes="36px"
                          className={listingPhotoFillClassName}
                          unoptimized={listingImageShouldBypassOptimization(threadListingThumbSrc)}
                          onLoad={() => setListingBannerImageReady(true)}
                        />
                      </>
                    ) : null
                  }
                  primary={capitalizeWords(displayListing.title)}
                  secondary={`$${displayListing.price}`}
                  className="ml-auto max-w-[11rem] sm:max-w-[14rem]"
                />
              ) : null}
            </div>
            <Link
              href={helpHubHref({ conversationId: id })}
              className="hidden shrink-0 px-2 text-[15px] font-medium text-listingHeart hover:underline sm:block"
            >
              Help
            </Link>
          </div>
        </header>
        ) : null}

        <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", messageThreadCanvasClassName())}>
          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [scrollbar-width:thin]"
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
              <div className="flex min-h-full flex-col justify-end px-3 pb-4 pt-2 sm:px-4 sm:pt-3">
                {orderedMessages.map((message, index) => {
                  const isOwn = message.sender_id === currentUserId
                  const offer =
                    message.offer_id && offersById[message.offer_id]
                      ? offersById[message.offer_id]
                      : undefined
                  const isSeller = currentUserId === conversation.seller_id

                  const prev = index > 0 ? orderedMessages[index - 1] : null
                  const next =
                    index < orderedMessages.length - 1 ? orderedMessages[index + 1] : null
                  const separatorBefore = shouldBreakMessageGroup(
                    prev?.created_at ?? null,
                    message.created_at,
                  )
                  const cardMargin = separatorBefore ? '' : 'mt-2.5'

                  const body = (() => {
                    const policyBlock = parseLocalPolicyBlockMetadata(message.metadata)
                    if (policyBlock && isOwn) {
                      return (
                        <div className={cardMargin}>
                          <LocalPhonePolicyBlockBubble
                            originalContent={policyBlock.originalContent}
                            reasonCode={policyBlock.reasonCode}
                            formattedTime={threadTime(message.created_at)}
                            relatedConversationId={id}
                          />
                        </div>
                      )
                    }

                    if (offer && message.offer_id) {
                      return (
                        <div
                          id={offerMessageAnchorId(message.offer_id)}
                          className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}
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
                            onThreadRefresh={refreshThread}
                          />
                        </div>
                      )
                    }

                    if (message.offer_id && message.content.trim()) {
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
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
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
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
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <OrderCompletedMessageCard
                            payload={orderCompleted}
                            createdAt={message.created_at}
                            viewerIsSeller={isSeller}
                          />
                        </div>
                      )
                    }

                    const orderRefunded = parseOrderRefundedMessageMetadata(message.metadata)
                    if (orderRefunded) {
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <OrderRefundedMessageCard
                            payload={orderRefunded}
                            createdAt={message.created_at}
                            viewerIsSeller={isSeller}
                          />
                        </div>
                      )
                    }

                    const shippingLabel = parseShippingLabelThreadMessage(
                      message.content,
                      message.metadata,
                    )
                    if (shippingLabel) {
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <ShippingLabelMessageCard
                            payload={shippingLabel}
                            createdAt={message.created_at}
                            viewerRole={isSeller ? 'seller' : 'buyer'}
                            hideLabelFromSeller={
                              isSeller &&
                              shippingLabel.orderId != null &&
                              hiddenShippingLabelOrderIds.has(shippingLabel.orderId)
                            }
                          />
                        </div>
                      )
                    }

                    const orderShipped = parseOrderShippedThreadMessage(
                      message.content,
                      message.metadata,
                    )
                    if (orderShipped) {
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <OrderShippedMessageCard
                            payload={orderShipped}
                            createdAt={message.created_at}
                            viewerRole={isSeller ? 'seller' : 'buyer'}
                          />
                        </div>
                      )
                    }

                    const exclusiveRepurchase = parseOrderExclusiveRepurchaseMessageMetadata(message.metadata)
                    if (exclusiveRepurchase) {
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <OrderExclusiveRepurchaseMessageCard
                            payload={exclusiveRepurchase}
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
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <ReviewRequestMessageCard
                            payload={reviewRequested}
                            createdAt={message.created_at}
                            viewerIsBuyer={viewerIsBuyer}
                            sellerDisplayName={sellerDisplayName}
                            onAfterReviewSubmitted={refreshThread}
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
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <MessageLocationCard
                            payload={locationPin}
                            formattedTime={threadTime(message.created_at)}
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
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <MessageMediaAttachmentCard
                            messageId={message.id}
                            metadata={message.metadata}
                            content={message.content}
                            isOwn={isOwn}
                            formattedTime={threadTime(message.created_at)}
                            showTime={false}
                            onOpenImage={openThreadImage}
                          />
                        </div>
                      )
                    }

                    const negotiationKind = parseOfferNegotiationMessage(message.content)
                    if (negotiationKind) {
                      const listingIdForOffer =
                        threadPrimaryListingId ?? conversation?.listing_id
                      const offersList = Object.values(offersById)
                      const actionable =
                        !isSeller &&
                        (negotiationKind === 'counter' || negotiationKind === 'seller_offer')
                          ? resolveActionableCounteredOffer(
                              offersList,
                              negotiationKind,
                              message.content,
                              listingIdForOffer,
                            )
                          : null
                      const checkoutOffer =
                        !isSeller && negotiationKind === 'accepted'
                          ? resolveAcceptedOfferForCheckout(
                              offersList,
                              negotiationKind,
                              message.content,
                              listingIdForOffer,
                            )
                          : null
                      const checkoutLineItems = checkoutOffer
                        ? parseOfferLineItems(checkoutOffer.line_items)
                        : null
                      const linkedOffer =
                        (message.offer_id ? offersById[message.offer_id] : undefined) ??
                        actionable ??
                        checkoutOffer ??
                        resolveNegotiationOffer(
                          offersList,
                          message.content,
                          listingIdForOffer,
                        )
                      const negotiationOfferHref = linkedOffer
                        ? dashboardOffersPath({
                            role: isSeller ? 'seller' : 'buyer',
                            offerId: linkedOffer.id,
                          })
                        : null
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <OfferNegotiationEventCard
                            kind={negotiationKind}
                            content={message.content}
                            createdAt={message.created_at}
                            isOwn={isOwn}
                            offerHref={negotiationOfferHref}
                            actionableOfferId={actionable?.id ?? null}
                            actionableExpiresAt={actionable?.expires_at ?? null}
                            checkoutOfferId={checkoutOffer?.id ?? null}
                            checkoutLineItemCount={checkoutLineItems?.length ?? 0}
                            onThreadRefresh={refreshThread}
                          />
                        </div>
                      )
                    }

                    if (message.content.trimStart().startsWith('Offer:') && !message.offer_id) {
                      return (
                        <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start', cardMargin)}>
                          <OfferLegacyMirrorCard
                            content={message.content}
                            createdAt={message.created_at}
                          />
                        </div>
                      )
                    }

                    const supportSystem = parseSupportThreadSystemMessage(message.content)
                    if (supportSystem?.kind === 'opened') {
                      return (
                        <div className={cn('flex w-full justify-center', cardMargin || 'mt-2.5')}>
                          <SupportCaseOpenedCard
                            parsed={supportSystem}
                            createdAt={message.created_at}
                          />
                        </div>
                      )
                    }
                    if (supportSystem?.kind === 'status') {
                      return (
                        <div className={cn('flex w-full justify-center', cardMargin || 'mt-2.5')}>
                          <SupportCaseStatusCard
                            parsed={supportSystem}
                            createdAt={message.created_at}
                          />
                        </div>
                      )
                    }

                    const groupedWithPrev =
                      !!prev &&
                      !separatorBefore &&
                      prev.sender_id === message.sender_id &&
                      isPlainTextMessage(prev)
                    const nextBreaks = next
                      ? shouldBreakMessageGroup(message.created_at, next.created_at)
                      : true
                    const groupedWithNext =
                      !!next &&
                      !nextBreaks &&
                      next.sender_id === message.sender_id &&
                      isPlainTextMessage(next)
                    const group = messageBubbleGroup(groupedWithPrev, groupedWithNext)
                    const rowMargin = separatorBefore
                      ? ''
                      : groupedWithPrev
                        ? 'mt-[2px]'
                        : 'mt-2'

                    return (
                      <div
                        className={cn(
                          'flex w-full flex-col',
                          isOwn ? 'items-end' : 'items-start',
                          rowMargin,
                        )}
                      >
                        <MessageTextBubble
                          content={message.content}
                          isOwn={isOwn}
                          group={group}
                          title={formatMessageTooltipTimestamp(message.created_at)}
                          className={message.sendStatus === 'failed' ? 'opacity-80' : undefined}
                        />
                        {isOwn && message.sendStatus === 'failed' ? (
                          <button
                            type="button"
                            className="mt-0.5 pr-1 text-[11px] font-medium text-red-500"
                            onClick={() => void sendThreadText(message.content, message.id)}
                          >
                            Not Delivered — Tap to Retry
                          </button>
                        ) : null}
                      </div>
                    )
                  })()

                  return (
                    <Fragment key={message.id}>
                      {separatorBefore ? (
                        <div className="flex justify-center pb-2 pt-3 first:pt-1">
                          <span className="text-[12px] font-medium tabular-nums text-muted-foreground/80">
                            {threadTime(message.created_at)}
                          </span>
                        </div>
                      ) : null}
                      {body}
                    </Fragment>
                  )
                })}
                {lastOwnReceipt ? (
                  <p className="mt-1 pr-1 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                    {lastOwnReceipt}
                  </p>
                ) : null}
              </div>
            )}
          </div>

        <MessageThreadMobileComposerDock>
          <MessageComposerBar
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onSubmit={handleSend}
            unlock={composerUnlock}
            composerUnlockToken={composerUnlock.token}
            leadingActions={
              canMakeSellerOffer && sellerOfferListingId ? (
                <MessageSellerOfferButton
                  conversationId={id}
                  listingId={sellerOfferListingId}
                  buyerUserId={conversation.buyer_id}
                  sellerUserId={conversation.seller_id}
                  listingTitle={sellerOfferListing?.title ?? listingTitleForOffers}
                  listPrice={listPriceNum}
                  primaryImageUrl={threadListingThumbSrc || null}
                  onOfferSent={refreshThread}
                />
              ) : null
            }
            media={{
              conversationId: id,
              disabled: !currentUserId || !conversation,
              onSent: handleMediaSent,
              onBlockedPolicy: (originalContent, reasonCode) => {
                if (!currentUserId) return
                setMessages((prev) => [
                  ...prev,
                  createLocalPolicyBlockMessage({
                    senderId: currentUserId,
                    originalContent,
                    reasonCode,
                  }),
                ])
                setNewMessage('')
              },
            }}
          />
        </MessageThreadMobileComposerDock>
        </div>
      </div>
      <MessageMediaImageLightbox
        open={threadImageLightboxOpen}
        onOpenChange={setThreadImageLightboxOpen}
        items={threadImageGallery}
        index={threadImageLightboxIndex}
        onIndexChange={setThreadImageLightboxIndex}
      />
    </main>
  )
}
