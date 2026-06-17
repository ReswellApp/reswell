'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MessageComposerTextarea } from '@/components/features/messages/message-composer-textarea'
import { ConversationThreadSkeleton } from '@/components/features/messages/messages-page-skeletons'
import { ConversationPartyProfile } from '@/components/features/messages/conversation-party-profile'
import {
  loadOtherPartyProfile,
  type OtherPartyProfileSummary,
} from '@/lib/messages/profile-reviews-loader'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailPath } from '@/lib/listing-query'
import { listingTitleThumbnailSrc, type ListingImageForCard } from '@/lib/listing-image-display'
import { listingImageShouldBypassOptimization } from '@/lib/listing-media-proxy-url'
import { sendMarketplaceListingMessage } from '@/app/actions/messages'
import { getPolicyBlockFromSendResult } from '@/lib/messages/policy-block-client'
import type { MessagePolicyReasonCode } from '@/lib/messages/fraud-reason-codes'
import { LocalPhonePolicyBlockBubble } from '@/components/features/messages/local-phone-policy-block-bubble'
import { cn } from '@/lib/utils'
import { MessageThreadMobileComposerDock } from '@/components/features/messages/message-thread-mobile-composer-dock'
import { messageComposerBarClass } from '@/lib/utils/dashboard-display-styles'
import { scrollPageToMessageThreadBottom } from '@/lib/utils/message-thread-routes'
import { isAbortError } from '@/lib/utils/is-abort-error'

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

  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [listing, setListing] = useState<ListingPreview | null>(null)
  const [counterparty, setCounterparty] = useState<CounterpartyPreview | null>(null)
  const [otherPartyProfile, setOtherPartyProfile] = useState<OtherPartyProfileSummary | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [blockedPolicyNotice, setBlockedPolicyNotice] = useState<{
    content: string
    reasonCode: MessagePolicyReasonCode
  } | null>(null)
  const [listingBannerImageReady, setListingBannerImageReady] = useState(false)
  const [useMobileComposerDock, setUseMobileComposerDock] = useState(false)

  useLayoutEffect(() => {
    const isMobile = window.matchMedia('(max-width: 1023px)').matches
    setUseMobileComposerDock(isMobile)
    if (isMobile) {
      scrollPageToMessageThreadBottom()
    }
  }, [loading, listing, counterparty])

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
        router.replace(`/auth/login?redirect=${encodeURIComponent(`/messages/new?user=${otherUserId}&listing=${listingId}`)}`)
        return
      }
      setCurrentUserId(user.id)

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
  }, [listingId, otherUserId, router, supabase])

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

    setSending(true)
    try {
      const result = await sendMarketplaceListingMessage({
        listing_id: listingId,
        other_user_id: otherUserId,
        content: trimmed,
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
      <div className="container mx-auto flex h-full min-h-0 max-w-2xl flex-1 flex-col overflow-hidden px-4 pb-0 pt-2 max-sm:pt-0 sm:px-5 sm:pb-6 sm:pt-3 md:max-w-4xl lg:max-w-5xl lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <header className="z-10 shrink-0 -mx-4 mb-2 border-b border-border/60 bg-background/85 px-2 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:-mx-5 sm:mb-3 sm:px-3">
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
            <ConversationPartyProfile
              displayName={counterparty.display_name}
              avatarUrl={counterparty.avatar_url}
              shopVerified={!!counterparty.shop_verified}
              profile={otherPartyProfile}
              secondaryLine={
                <Link
                  href={listingDetailPath(listing)}
                  className="block truncate text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {capitalizeWords(listing.title)}
                </Link>
              }
            />
          </div>
        </header>

        <Link
          href={listingDetailPath(listing)}
          className="mb-4 block overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-colors hover:bg-muted/40 active:bg-muted/55 dark:shadow-none"
        >
          <div className="flex gap-3 p-3">
            <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-muted">
              {threadListingThumbSrc ? (
                <>
                  {!listingBannerImageReady ? (
                    <div className="absolute inset-0 z-10 animate-pulse rounded-2xl bg-muted" aria-hidden />
                  ) : null}
                  <Image
                    key={threadListingThumbSrc}
                    src={threadListingThumbSrc}
                    alt={capitalizeWords(listing.title)}
                    fill
                    sizes="72px"
                    className="object-cover object-center"
                    unoptimized={listingImageShouldBypassOptimization(threadListingThumbSrc)}
                    onLoad={() => setListingBannerImageReady(true)}
                  />
                </>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <p className="text-[17px] font-semibold leading-snug text-foreground">
                {capitalizeWords(listing.title)}
              </p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-foreground">
                ${listing.price}
              </p>
            </div>
          </div>
        </Link>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-border/50 bg-muted/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-muted/25',
            'sm:max-h-[min(26rem,52svh)] sm:flex-none sm:h-[min(24rem,45svh)] md:h-[min(34rem,52svh)] md:max-h-[min(42rem,68svh)] lg:h-[min(38rem,56svh)] lg:max-h-[min(48rem,72svh)]',
          )}
        >
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center">
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
        </div>

        <MessageThreadMobileComposerDock portaled={useMobileComposerDock}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSend()
            }}
            className={cn("mt-2 sm:mt-3", messageComposerBarClass)}
          >
          <MessageComposerTextarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              if (blockedPolicyNotice) setBlockedPolicyNotice(null)
            }}
            placeholder="Message"
            disabled={sending}
            autoComplete="off"
            aria-label="Message text"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sending || !newMessage.trim()}
            className={cn(
              'mb-0.5 h-10 w-10 shrink-0 rounded-full',
              'bg-listingHeart text-white shadow-sm hover:bg-[#2a4170]',
              'dark:bg-listingHeart dark:text-white dark:hover:bg-[#2a4170]',
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
        </MessageThreadMobileComposerDock>
      </div>
    </main>
  )
}

export default function NewMessageComposePage() {
  return (
    <Suspense fallback={<ConversationThreadSkeleton />}>
      <NewMessageComposeContent />
    </Suspense>
  )
}
