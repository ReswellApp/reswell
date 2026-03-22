'use client'

import { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { VerifiedBadge } from '@/components/verified-badge'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'

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
          listing:listings(id, title, price, section, listing_images(url)),
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

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: currentUserId,
        content,
      })
      .select('*')
      .single()

    if (!error && inserted) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? (inserted as Message) : m))
      )
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id)
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
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
        <main className="flex flex-1 items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
    )
  }

  const otherUser = conversation.buyer_id === currentUserId ? conversation.seller : conversation.buyer

  return (
      <main className="flex-1 container mx-auto py-4 flex flex-col max-w-3xl bg-background">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <Link href="/messages">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted">
              {otherUser?.avatar_url ? (
                <Image
                  src={otherUser.avatar_url || "/placeholder.svg"}
                  alt={otherUser.display_name || ''}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-foreground font-semibold">
                  {otherUser?.display_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground flex items-center gap-1">
                {otherUser?.display_name}
                {otherUser?.shop_verified && <VerifiedBadge size="sm" />}
              </p>
              {conversation.listing && (
                <Link 
                  href={`/${conversation.listing.section}/${conversation.listing.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {capitalizeWords(conversation.listing?.title)}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Listing Preview */}
        {conversation.listing && (
          <Link href={`/${conversation.listing.section}/${conversation.listing.id}`}>
            <Card className="mt-4 hover:bg-muted/50 transition-colors">
              <CardContent className="p-3 flex gap-3">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {conversation.listing.listing_images?.[0]?.url ? (
                    <Image
                      src={conversation.listing.listing_images[0].url || "/placeholder.svg"}
                      alt={capitalizeWords(conversation.listing?.title)}
                      fill
                      className="object-contain"
                      style={{ objectFit: "contain" }}
                    />
                  ) : null}
                </div>
                <div>
                  <p className="font-medium text-foreground">{capitalizeWords(conversation.listing?.title)}</p>
                  <p className="text-lg font-bold text-black dark:text-white">${conversation.listing.price}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === currentUserId
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
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
        <div className="pt-4 border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-2"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !newMessage.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </main>
  )
}
