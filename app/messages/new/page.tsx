'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MessageComposerBar } from '@/components/features/messages/message-composer-bar'
import { ConversationThreadSkeleton } from '@/components/features/messages/messages-page-skeletons'
import { ConversationPartyProfile } from '@/components/features/messages/conversation-party-profile'
import { ConversationThreadHeaderChip } from '@/components/features/messages/conversation-thread-header-chip'
import { MessagesChatSplit } from '@/components/features/messages/messages-chat-split'
import { messageThreadCanvasClassName } from '@/components/features/messages/message-text-bubble'
import {
  loadOtherPartyProfile,
  type OtherPartyProfileSummary,
} from '@/lib/messages/profile-reviews-loader'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailPath } from '@/lib/listing-query'
import { listingTitleThumbnailSrc, type ListingImageForCard } from '@/lib/listing-image-display'
import { listingPhotoFillClassName } from '@/lib/listing-photo-fill'
import { listingImageShouldBypassOptimization } from '@/lib/listing-media-proxy-url'
import {
  ensureMarketplaceListingConversation,
  ensureMarketplaceThread,
  sendMarketplaceListingMessage,
} from '@/app/actions/messages'
import { offerMessageAnchorId } from '@/lib/utils/offer-messages-href'
import { isUuidString } from '@/lib/utils/isUuid'
import { getPolicyBlockFromSendResult } from '@/lib/messages/policy-block-client'
import type { MessagePolicyReasonCode } from '@/lib/messages/fraud-reason-codes'
import { LocalPhonePolicyBlockBubble } from '@/components/features/messages/local-phone-policy-block-bubble'
import { cn } from '@/lib/utils'
import { MessageThreadMobileComposerDock } from '@/components/features/messages/message-thread-mobile-composer-dock'
import { isAbortError } from '@/lib/utils/is-abort-error'
import { useComposerUnlock } from '@/hooks/use-composer-unlock'
import { COMPOSER_UNLOCK_DENIED_ERROR } from '@/lib/messages/composer-unlock-errors'

type ListingPreview = {
  id: string
  title: string
  price: number
  section: string
  slug?: string | null
  listing_images: ListingImageForCard[]
}

type CounterpartyPreview = {
  id: string
  display_name: string
  avatar_url: string | null
  shop_verified?: boolean
}

function NewMessageComposeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const otherUserId = searchParams.get('user')
  const listingId = searchParams.get('listing')
  const offerId = searchParams.get('offer')

  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [listing, setListing] = useState<ListingPreview | null>(null)
  const [counterparty, setCounterparty] = useState<CounterpartyPreview | null>(null)
  const [otherPartyProfile, setOtherPartyProfile] = useState<OtherPartyProfileSummary | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const composerUnlock = useComposerUnlock({ scope: 'marketplace' })
  const [blockedPolicyNotice, setBlockedPolicyNotice] = useState<{
    content: string
    reasonCode: MessagePolicyReasonCode
  } | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const [listingBannerImageReady, setListingBannerImageReady] = useState(false)

  const threadListingThumbSrc = useMemo(() => {
    if (!listing) return ''
    return listingTitleThumbnailSrc(listing.listing_images)
  }, [listing])

  useEffect(() => {
    setListingBannerImageReady(false)
  }, [threadListingThumbSrc])

  const loadComposeContext = useCallback(async (isActive: () => boolean = () => true) => {
    if (!otherUserId || !listingId) {
      if (isActive()) setLoading(false)
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!isActive()) return
      if (!user) {
        const loginParams = new URLSearchParams({
          user: otherUserId,
          listing: listingId,
        })
        if (offerId) loginParams.set('offer', offerId)
        router.replace(`/auth/login?redirect=${encodeURIComponent(`/messages/new?${loginParams.toString()}`)}`)
        return
      }
      setCurrentUserId(user.id)

      const opened = await ensureMarketplaceThread({
        listing_id: listingId,
        other_user_id: otherUserId,
      })
      if (!isActive()) return
      if ('conversation_id' in opened && opened.conversation_id) {
        const hash =
          offerId && isUuidString(offerId) ? `#${offerMessageAnchorId(offerId)}` : ''
        router.replace(`/messages/${opened.conversation_id}${hash}`)
        return
      }

      const [{ data: listingRow }, { data: profileRow }] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, price, section, slug, user_id, listing_images(url, thumbnail_url, is_primary)')
          .eq('id', listingId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, shop_verified')
          .eq('id', otherUserId)
          .maybeSingle(),
      ])
      if (!isActive()) return

      if (!listingRow) {
        toast.error('Listing not found')
        router.replace('/messages')
        return
      }

      const sellerId = listingRow.user_id as string
      const viewerIsSeller = sellerId === user.id
      const viewerIsBuyer = user.id !== sellerId && otherUserId === sellerId
      if (!viewerIsSeller && !viewerIsBuyer) {
        toast.error('You can’t open this conversation')
        router.replace('/messages')
        return
      }

      setListing(listingRow as ListingPreview)
      setCounterparty(
        (profileRow as CounterpartyPreview | null) ?? {
          id: otherUserId,
          display_name: 'Member',
          avatar_url: null,
        },
      )

      void loadOtherPartyProfile(supabase, otherUserId)
        .then((snapshot) => {
          if (!isActive()) return
          setOtherPartyProfile(snapshot)
        })
        .catch(() => {})
    } catch (err) {
      if (isActive() && !isAbortError(err)) {
        toast.error('Could not load conversation')
        router.replace('/messages')
      }
    } finally {
      if (isActive()) setLoading(false)
    }
  }, [listingId, offerId, otherUserId, router, supabase])

  useEffect(() => {
    let active = true
    void loadComposeContext(() => active)
    return () => {
      active = false
    }
  }, [loadComposeContext])

  const handleSend = async () => {
    const trimmed = newMessage.trim()
    if (!trimmed || !otherUserId || !listingId || !currentUserId) return

    const unlockToken = await composerUnlock.ensure()
    if (!unlockToken) {
      toast.error(COMPOSER_UNLOCK_DENIED_ERROR)
      return
    }

    setSending(true)
    try {
      const result = await sendMarketplaceListingMessage({
        listing_id: listingId,
        other_user_id: otherUserId,
        content: trimmed,
        composer_unlock_token: unlockToken,
      })

      if ('error' in result) {
        const policyReason = getPolicyBlockFromSendResult(result)
        if (policyReason) {
          setBlockedPolicyNotice({ content: trimmed, reasonCode: policyReason })
          setNewMessage('')
          return
        }
        toast.error(result.error === 'Unauthorized' ? 'Sign in again to send messages.' : result.error)
        return
      }

      setBlockedPolicyNotice(null)
      setNewMessage('')
      router.replace(`/messages/${result.conversation_id}`)
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (!otherUserId || !listingId) {
    return (
      <main className="flex-1 bg-background">
        <div className="container mx-auto max-w-2xl px-4 py-16 text-center md:max-w-4xl lg:max-w-5xl">
          <p className="text-[17px] font-medium text-foreground">Missing conversation details</p>
          <Button asChild variant="outline" className="mt-4 rounded-full">
            <Link href="/messages">Back to messages</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (loading || !listing || !counterparty) {
    return <ConversationThreadSkeleton />
  }

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 shrink-0 border-b border-border/60 bg-background/90 px-2 py-1.5 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:px-3">
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/messages" className="shrink-0 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-foreground hover:bg-muted/80"
                aria-label="Back to messages"
              >
                <ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} />
              </Button>
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <ConversationPartyProfile
                displayName={counterparty.display_name}
                avatarUrl={counterparty.avatar_url}
                shopVerified={!!counterparty.shop_verified}
                profile={otherPartyProfile}
              />
              <ConversationThreadHeaderChip
                href={listingDetailPath(listing)}
                ariaLabel={`View listing: ${capitalizeWords(listing.title)}`}
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
                primary={capitalizeWords(listing.title)}
                secondary={`$${listing.price}`}
                className="ml-auto max-w-[11rem] sm:max-w-[14rem]"
              />
            </div>
          </div>
        </header>

        <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', messageThreadCanvasClassName())}>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-8 text-center">
            {blockedPolicyNotice ? (
              <div className="w-full max-w-md">
                <LocalPhonePolicyBlockBubble
                  originalContent={blockedPolicyNotice.content}
                  reasonCode={blockedPolicyNotice.reasonCode}
                  relatedConversationId={null}
                  align="inline"
                />
              </div>
            ) : (
              <>
                <p className="text-[17px] font-medium text-foreground/90">No messages yet</p>
                <p className="mt-1.5 max-w-[18rem] text-[15px] leading-relaxed text-muted-foreground">
                  Send a message to start the conversation.
                </p>
              </>
            )}
          </div>

        <MessageThreadMobileComposerDock>
          <MessageComposerBar
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              if (blockedPolicyNotice) setBlockedPolicyNotice(null)
            }}
            onSubmit={handleSend}
            sending={sending}
            unlock={composerUnlock}
            composerUnlockToken={composerUnlock.token}
            media={{
              conversationId,
              disabled: sending || !otherUserId || !listingId || !currentUserId,
              ensureConversationId: async () => {
                if (!otherUserId || !listingId) return null
                const result = await ensureMarketplaceListingConversation({
                  listing_id: listingId,
                  other_user_id: otherUserId,
                })
                if ('error' in result) {
                  toast.error(
                    result.error === 'Unauthorized'
                      ? 'Sign in again to send photos and videos.'
                      : result.error,
                  )
                  return null
                }
                setConversationId(result.conversation_id)
                conversationIdRef.current = result.conversation_id
                return result.conversation_id
              },
              onSent: () => {
                setBlockedPolicyNotice(null)
                setNewMessage('')
                const targetId = conversationIdRef.current
                if (targetId) {
                  router.replace(`/messages/${targetId}`)
                }
              },
              onBlockedPolicy: (originalContent, reasonCode) => {
                setBlockedPolicyNotice({ content: originalContent, reasonCode })
                setNewMessage('')
              },
            }}
          />
        </MessageThreadMobileComposerDock>
        </div>
      </div>
    </main>
  )
}

export default function NewMessageComposePage() {
  return (
    <MessagesChatSplit>
      <Suspense fallback={<ConversationThreadSkeleton />}>
        <NewMessageComposeContent />
      </Suspense>
    </MessagesChatSplit>
  )
}
