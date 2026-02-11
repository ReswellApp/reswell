'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MessageCircle, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
  }
  seller: {
    id: string
    display_name: string
    avatar_url: string | null
  }
  messages: {
    content: string
    is_read: boolean
    sender_id: string
  }[]
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchConversations() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          listing:listings(id, title, listing_images(url)),
          buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url),
          seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url),
          messages(content, is_read, sender_id)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (!error && data) {
        setConversations(data as Conversation[])
      }
      setLoading(false)
    }

    fetchConversations()
  }, [supabase])

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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
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
          ) : filteredConversations.length === 0 ? (
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
                                alt={conv.listing.title}
                                fill
                                className="object-cover"
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
                                <p className="font-semibold text-foreground truncate">
                                  {otherUser?.display_name || 'Unknown User'}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {conv.listing?.title || 'General inquiry'}
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
        </div>
      </main>
      <Footer />
    </div>
  )
}
