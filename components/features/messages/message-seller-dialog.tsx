'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageComposerTextarea } from '@/components/features/messages/message-composer-textarea'
import { VerifiedBadge } from '@/components/verified-badge'
import { LocalPhonePolicyBlockBubble } from '@/components/features/messages/local-phone-policy-block-bubble'
import { MessageMediaSendButton } from '@/components/features/messages/message-media-send-button'
import { MessageMediaAttachmentCard } from '@/components/features/messages/message-media-attachment-card'
import {
  ensureMarketplaceListingConversation,
  sendConversationReply,
  sendMarketplaceListingMessage,
} from '@/app/actions/messages'
import { getPolicyBlockFromSendResult } from '@/lib/messages/policy-block-client'
import type { MessagePolicyReasonCode } from '@/lib/messages/fraud-reason-codes'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingTitleThumbnailSrc, type ListingImageForCard } from '@/lib/listing-image-display'
import { listingImageShouldBypassOptimization } from '@/lib/listing-media-proxy-url'
import { cn } from '@/lib/utils'
import { isAbortError } from '@/lib/utils/is-abort-error'

interface MessageSellerDialogProps {
  listingId: string
  sellerId: string
  sellerDisplayName: string
  sellerAvatarSrc?: string | null
  sellerShopVerified?: boolean
  /** Styling for the "Message Seller" trigger button. */
  triggerClassName?: string
}

type ListingPreview = {
  title: string
  price: number
  listing_images: ListingImageForCard[]
}

type SentMessage = {
  id: string
  content: string
  timeLabel: string
  /** Present for media messages — rendered via the shared attachment card. */
  mediaMetadata?: unknown
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/**
 * eBay-style "Message seller" popup: near-fullscreen card on mobile,
 * right-anchored panel on desktop. First send creates the conversation;
 * follow-up sends reply into it without leaving the listing page.
 */
export function MessageSellerDialog({
  listingId,
  sellerId,
  sellerDisplayName,
  sellerAvatarSrc,
  sellerShopVerified = false,
  triggerClassName,
}: MessageSellerDialogProps) {
  const [open, setOpen] = useState(false)
  const [listing, setListing] = useState<ListingPreview | null>(null)
  const [listingLoadFailed, setListingLoadFailed] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([])
  const [blockedPolicyNotice, setBlockedPolicyNotice] = useState<{
    content: string
    reasonCode: MessagePolicyReasonCode
  } | null>(null)

  const listingThumbSrc = useMemo(
    () => (listing ? listingTitleThumbnailSrc(listing.listing_images) : ''),
    [listing],
  )

  const loadListingPreview = useCallback(
    async (isActive: () => boolean) => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('listings')
          .select('title, price, listing_images(url, thumbnail_url, is_primary)')
          .eq('id', listingId)
          .maybeSingle()
        if (!isActive()) return
        if (data) {
          setListing(data as ListingPreview)
        } else {
          setListingLoadFailed(true)
        }
      } catch (err) {
        if (isActive() && !isAbortError(err)) setListingLoadFailed(true)
      }
    },
    [listingId],
  )

  useEffect(() => {
    if (!open || listing || listingLoadFailed) return
    let active = true
    void loadListingPreview(() => active)
    return () => {
      active = false
    }
  }, [open, listing, listingLoadFailed, loadListingPreview])

  const handleSend = async () => {
    const trimmed = newMessage.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      const result = conversationId
        ? await sendConversationReply({ conversation_id: conversationId, content: trimmed })
        : await sendMarketplaceListingMessage({
            listing_id: listingId,
            other_user_id: sellerId,
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

      if (!conversationId && 'conversation_id' in result && typeof result.conversation_id === 'string') {
        setConversationId(result.conversation_id)
      }
      setBlockedPolicyNotice(null)
      setNewMessage('')
      setSentMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-${prev.length}`, content: trimmed, timeLabel: nowTimeLabel() },
      ])
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="mr-2 h-[18px] w-[18px]" aria-hidden />
        Message Seller
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
        overlayClassName="bg-black/45"
        className={cn(
          'flex flex-col gap-0 overflow-hidden rounded-2xl p-0 !translate-x-0 !translate-y-0',
          // Mobile: near-fullscreen card
          'max-sm:!bottom-2 max-sm:!left-2 max-sm:!right-2 max-sm:!top-2 max-sm:h-auto max-sm:w-auto max-sm:max-w-none',
          // Desktop: panel anchored to the right edge
          'sm:bottom-4 sm:left-auto sm:right-4 sm:top-4 sm:w-[400px] sm:max-w-[400px]',
        )}
      >
        <div className="shrink-0 border-b border-border/60 px-5 pb-4 pt-5">
          <DialogTitle className="pr-8 text-[19px] font-bold tracking-tight">
            Message seller
          </DialogTitle>

          <div className="mt-4 flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={sellerAvatarSrc ?? undefined} alt="" />
              <AvatarFallback className="text-sm font-semibold">
                {sellerDisplayName.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-foreground">
              <span className="truncate">{sellerDisplayName}</span>
              {sellerShopVerified ? <VerifiedBadge size="sm" /> : null}
            </p>
          </div>

          {listing ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                {listingThumbSrc ? (
                  <Image
                    src={listingThumbSrc}
                    alt={capitalizeWords(listing.title)}
                    fill
                    sizes="48px"
                    className="object-cover object-center"
                    unoptimized={listingImageShouldBypassOptimization(listingThumbSrc)}
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">
                  {capitalizeWords(listing.title)}
                </p>
                <p className="mt-0.5 text-[15px] font-bold tabular-nums text-foreground">
                  ${listing.price}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            We scan and review messages for fraud and policy violations, and to surface
            relevant service-related help.
          </p>

          {sentMessages.length > 0 || blockedPolicyNotice ? (
            <>
              <p className="mt-4 text-center text-[12px] font-medium text-muted-foreground">
                Today
              </p>
              <ul className="mt-2 space-y-2">
                {sentMessages.map((m) => (
                  <li key={m.id} className="flex flex-col items-end">
                    {m.mediaMetadata ? (
                      <MessageMediaAttachmentCard
                        messageId={m.id}
                        metadata={m.mediaMetadata}
                        content={m.content}
                        isOwn
                        formattedTime={m.timeLabel}
                      />
                    ) : (
                      <>
                        <div className="max-w-[85%] rounded-[18px] rounded-br-[6px] bg-muted px-3.5 py-2.5">
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-foreground">
                            {m.content}
                          </p>
                        </div>
                        <span className="mt-1 text-[11px] text-muted-foreground">{m.timeLabel}</span>
                      </>
                    )}
                  </li>
                ))}
                {blockedPolicyNotice ? (
                  <li>
                    <LocalPhonePolicyBlockBubble
                      originalContent={blockedPolicyNotice.content}
                      reasonCode={blockedPolicyNotice.reasonCode}
                      relatedConversationId={conversationId}
                      align="inline"
                    />
                  </li>
                ) : null}
              </ul>
              {conversationId ? (
                <Link
                  href={`/messages/${conversationId}`}
                  className="mt-4 self-center text-[13px] font-semibold text-foreground underline underline-offset-4"
                >
                  View full conversation
                </Link>
              ) : null}
            </>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSend()
          }}
          className="shrink-0 space-y-2.5 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="flex items-end gap-1 rounded-full bg-muted/70 py-1 pl-1 pr-1.5">
            <MessageComposerTextarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                if (blockedPolicyNotice) setBlockedPolicyNotice(null)
              }}
              placeholder="Send message"
              disabled={sending}
              autoComplete="off"
              aria-label="Message text"
              className="text-[16px] placeholder:text-muted-foreground/80"
            />
            <MessageMediaSendButton
                conversationId={conversationId}
                ensureConversationId={async () => {
                  const result = await ensureMarketplaceListingConversation({
                    listing_id: listingId,
                    other_user_id: sellerId,
                  })
                  if ('error' in result) return null
                  setConversationId(result.conversation_id)
                  return result.conversation_id
                }}
                disabled={sending}
                caption={newMessage}
                onSent={(message) => {
                  setBlockedPolicyNotice(null)
                  setNewMessage('')
                  setSentMessages((prev) => [
                    ...prev,
                    {
                      id: message.id,
                      content: message.content,
                      timeLabel: nowTimeLabel(),
                      mediaMetadata: message.metadata,
                    },
                  ])
                }}
                onBlockedPolicy={(originalContent, reasonCode) => {
                  setBlockedPolicyNotice({ content: originalContent, reasonCode })
                  setNewMessage('')
                }}
                className="mb-0 text-foreground hover:bg-transparent"
              />
          </div>
          <Button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="min-h-touch w-full rounded-full text-[16px] font-semibold"
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" strokeWidth={2} />
            )}
            Send message
          </Button>
        </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
