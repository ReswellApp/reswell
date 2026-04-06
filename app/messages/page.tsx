'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MessageCircle, Search, Heart } from 'lucide-react'
import { VerifiedBadge } from '@/components/verified-badge'
import { formatDistanceToNow } from 'date-fns'
import { capitalizeWords } from '@/lib/listing-labels'
import { listingDetailHref } from '@/lib/listing-href'

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
  }[]
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  const userParam = searchParams.get('user')
  const listingParam = searchParams.get('listing')

  useEffect(() => {
    async function fetchConversations() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      setCurrentUserId(user.id)

      // If we have user + listing params, find or create that conversation and redirect
      if (userParam && listingParam && userParam !== user.id) {
        let { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('buyer_id', user.id)
          .eq('seller_id', userParam)
          .eq('listing_id', listingParam)
          .single()

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
          if (!createErr && newConv) conv = newConv
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
            messages(content, is_read, sender_id)
          `)
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false }),
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

  const filteredConversations = conversations.filter(conv => {
    const otherUser = conv.buyer_id === currentUserId ? conv.seller : conv.buyer
    const searchLower = searchQuery.toLowerCase()
    return (
      otherUser?.display_name?.toLowerCase().includes(searchLower) ||
      conv.listing?.title?.toLowerCase().includes(searchLower)
    )
  })

  const getUnreadCount = (conv: Conversation) => {
    return conv.messages.filter(m => !m.is_read && m.sender_id !== currentUserId).length
  }

  return (
      <main className="flex-1 container mx-auto py-8 bg-background">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-6">Messages</h1>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-muted rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {notifications.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-muted-foreground mb-3">Notifications</h2>
                  <div className="space-y-2">
                    {notifications.map((n) => {
                      const listing = n.listing ?? n.listings
                      const href =
                        n.listing_id && listing?.section
                          ? listingDetailHref(listing)
                          : "/favorites"
                      return (
                        <Link key={n.id} href={href}>
                          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                            <CardContent className="p-4 flex gap-4 items-center">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Heart className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">
                                  {n.message || 'Someone saved your item'}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {filteredConversations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No messages yet</h3>
                <p className="text-muted-foreground">
                  When you contact a seller or receive a message, it will appear here.
                </p>
              </CardContent>
            </Card>
              ) : (
            <div className="space-y-3">
              {filteredConversations.map((conv) => {
                const otherUser = conv.buyer_id === currentUserId ? conv.seller : conv.buyer
                const lastMessage = conv.messages[conv.messages.length - 1]
                const unreadCount = getUnreadCount(conv)

                return (
                  <Link key={conv.id} href={`/messages/${conv.id}`}>
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {conv.listing?.listing_images?.[0]?.url ? (
                              <Image
                                src={conv.listing.listing_images[0].url || "/placeholder.svg"}
                                alt={capitalizeWords(conv.listing?.title)}
                                fill
                                className="object-contain"
                                style={{ objectFit: "contain" }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <MessageCircle className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-foreground truncate flex items-center gap-1">
                                  <span className="truncate">{otherUser?.display_name || 'Unknown User'}</span>
                                  {otherUser?.shop_verified && <VerifiedBadge size="sm" />}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {capitalizeWords(conv.listing?.title) || 'General inquiry'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                                </span>
                                {unreadCount > 0 && (
                                  <Badge className="bg-primary text-primary-foreground">
                                    {unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {lastMessage && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {lastMessage.sender_id === currentUserId && 'You: '}
                                {lastMessage.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
              )}
            </>
          )}
        </div>
      </main>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
        <main className="flex-1 container mx-auto py-8 bg-background">
          <div className="max-w-3xl mx-auto animate-pulse space-y-4">
            <div className="h-9 bg-muted rounded w-48" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </main>
    }>
      <MessagesContent />
    </Suspense>
  )
}
