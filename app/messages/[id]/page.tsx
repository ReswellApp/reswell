'use client'

import { useEffect, useState, useRef, use } from 'react'
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

interface Message {
  id: string
  content: string
  sender_id: string
  is_read: boolean
  created_at: string
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
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Fetch conversation
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
      }

      // Fetch messages
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

      if (msgData) {
        setMessages(msgData)
      }

      // Mark messages in this conversation as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id)

      // Mark notifications as read when viewing messages (badge includes notifications)
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      // Notify header to refresh unread badge (delay so DB commit and listener are ready)
      if (typeof window !== 'undefined') {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('unreadCountRefresh')), 150)
      }
    }

    fetchData()

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
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !currentUserId || !conversation) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)

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

        {/* Messages */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[20px] bg-muted/50 px-3 py-4 sm:px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-[15px] text-muted-foreground">No messages yet.</p>
              <p className="mt-1 text-[13px] text-muted-foreground/90">Say hello to start the conversation.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === currentUserId
              return (
                <div
                  key={message.id}
                  className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[min(100%,20rem)] rounded-[22px] px-4 py-2.5 shadow-sm',
                      isOwn
                        ? 'rounded-br-md bg-foreground text-background'
                        : 'rounded-bl-md border border-border/50 bg-card text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words text-[17px] leading-snug">{message.content}</p>
                    <p
                      className={cn(
                        'mt-1.5 text-[11px] tabular-nums',
                        isOwn ? 'text-background/65' : 'text-muted-foreground',
                      )}
                    >
                      {formatMessageDate(message.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-end gap-2 rounded-[26px] border border-border/80 bg-card px-2 py-1.5 shadow-[0_1px_3px_rgba(17,17,17,0.06)] dark:shadow-none"
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
