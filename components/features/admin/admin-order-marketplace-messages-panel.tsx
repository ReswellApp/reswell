"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Loader2, MessageCircle } from "lucide-react"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminMarketplaceMessageBody } from "@/components/features/admin/admin-marketplace-message-body"

type AdminOrderMarketplaceMessagesPanelProps = {
  conversationId: string | null
  messageCount: number
  buyerId: string
  sellerId: string
  buyerName: string
  sellerName: string
}

export function AdminOrderMarketplaceMessagesPanel({
  conversationId,
  messageCount,
  buyerId,
  sellerId,
  buyerName,
  sellerName,
}: AdminOrderMarketplaceMessagesPanelProps) {
  const [messages, setMessages] = useState<AdminMarketplaceMessageListRow[]>([])
  const [loading, setLoading] = useState(Boolean(conversationId))
  const [error, setError] = useState<string | null>(null)

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("conversation_id", conversationId)
      params.set("order", "asc")
      params.set("limit", "500")
      params.set("offset", "0")

      const res = await fetch(`/api/admin/marketplace-messages?${params}`)
      const body = (await res.json()) as {
        data?: AdminMarketplaceMessageListRow[]
        error?: string
      }

      if (!res.ok || !body.data) {
        setMessages([])
        setError(body.error ?? "Could not load messages")
        return
      }

      setMessages(body.data)
    } catch {
      setMessages([])
      setError("Could not load messages")
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  function senderLabel(senderId: string, senderName: string | null | undefined): string {
    if (senderName?.trim()) return senderName.trim()
    if (senderId === buyerId) return buyerName
    if (senderId === sellerId) return sellerName
    return senderId.slice(0, 8)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
            Marketplace messages
          </CardTitle>
          <CardDescription>
            Buyer ↔ seller thread for this order&apos;s listing.
            {conversationId ? ` ${messageCount} message${messageCount === 1 ? "" : "s"}.` : ""}
          </CardDescription>
        </div>
        {conversationId ? (
          <Button variant="outline" size="sm" asChild className="gap-2 shrink-0">
            <Link href={`/admin/messages/${conversationId}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open full thread
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {!conversationId ? (
          <p className="text-sm text-muted-foreground">
            No marketplace conversation exists yet for this buyer, seller, and listing.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading messages…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
        ) : (
          <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => {
              const isBuyer = message.sender_id === buyerId
              const isSeller = message.sender_id === sellerId
              const bubbleTone = isBuyer
                ? "border-sky-500/25 bg-sky-500/[0.06]"
                : isSeller
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : "border-amber-500/30 bg-amber-500/[0.08]"

              return (
                <div
                  key={message.id}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${bubbleTone}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {senderLabel(message.sender_id, message.sender?.display_name)}
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {isBuyer ? "Buyer" : isSeller ? "Seller" : "Support"}
                      </span>
                    </span>
                    <time dateTime={message.created_at}>
                      {format(new Date(message.created_at), "MMM d, yyyy h:mm a")}
                    </time>
                  </div>
                  <AdminMarketplaceMessageBody
                    messageId={message.id}
                    metadata={message.metadata}
                    content={message.content}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
