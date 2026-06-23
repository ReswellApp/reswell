"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ExternalLink, Loader2, MessageCircle } from "lucide-react"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import { parseMarketplaceMessagePdfAttachment } from "@/lib/validations/marketplace-message-attachment"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OpenMarketplacePdfButton } from "@/components/features/messages/open-marketplace-pdf-button"

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
              const pdfAttachment = parseMarketplaceMessagePdfAttachment(message.metadata)
              const redundantCaption =
                pdfAttachment && message.content.trim() === `Attachment: ${pdfAttachment.file_name}`

              return (
                <div
                  key={message.id}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {senderLabel(message.sender_id, message.sender?.display_name)}
                    </span>
                    <time dateTime={message.created_at}>
                      {format(new Date(message.created_at), "MMM d, yyyy h:mm a")}
                    </time>
                  </div>
                  <div className="mt-2 space-y-2">
                    {pdfAttachment ? (
                      <OpenMarketplacePdfButton
                        messageId={message.id}
                        fileName={pdfAttachment.file_name}
                      />
                    ) : null}
                    {!redundantCaption && message.content.trim() ? (
                      <p className="whitespace-pre-wrap break-words text-foreground">
                        {message.content}
                      </p>
                    ) : null}
                    {message.metadata != null &&
                    typeof message.metadata === "object" &&
                    !pdfAttachment ? (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">Structured metadata</summary>
                        <pre className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-background p-2 text-[11px] leading-relaxed">
                          {JSON.stringify(message.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
