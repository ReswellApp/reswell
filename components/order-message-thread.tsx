"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, MessageCircle, Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { sendConversationReply, sendListingMessage } from "@/app/actions/messages"

export type OrderThreadMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
}

export function OrderMessageThread({
  conversationId,
  initialMessages,
  counterpartyName,
  currentUserId,
  variant,
  startConversation,
}: {
  conversationId: string | null
  initialMessages: OrderThreadMessage[]
  counterpartyName: string
  currentUserId: string
  variant: "seller" | "buyer"
  /** Buyer only: when there is no row yet, first send creates the conversation via `sendListingMessage`. */
  startConversation?: { listingId: string; sellerId: string } | null
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const canStartFromOrder =
    variant === "buyer" && !conversationId && !!startConversation?.listingId && !!startConversation?.sellerId

  async function send() {
    const text = body.trim()
    if (!text) return

    if (!conversationId) {
      if (!canStartFromOrder || !startConversation) return
      setSending(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          toast.error("Sign in to send a message")
          return
        }
        const result = await sendListingMessage({
          listing_id: startConversation.listingId,
          seller_id: startConversation.sellerId,
          content: text,
        })
        if ("error" in result) throw new Error(result.error)
        setBody("")
        toast.success("Message sent")
        router.refresh()
      } catch {
        toast.error("Could not send message")
      } finally {
        setSending(false)
      }
      return
    }

    setSending(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Sign in to send a message")
        return
      }
      const result = await sendConversationReply({
        conversation_id: conversationId,
        content: text,
      })

      if ("error" in result) throw new Error(result.error)

      const inserted = result.message as OrderThreadMessage
      setMessages((prev) => [...prev, inserted])
      setBody("")
      toast.success("Message sent")
    } catch {
      toast.error("Could not send message")
    } finally {
      setSending(false)
    }
  }

  const description =
    variant === "seller"
      ? "Recent messages about this listing. Replies go to the same thread as your inbox."
      : "Recent messages about this purchase. Replies go to the same thread as your inbox."

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages with {counterpartyName}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!conversationId && variant === "seller" && (
          <p className="text-sm text-muted-foreground">
            The buyer hasn&apos;t opened a message thread for this listing yet. When they do, it will
            show up here. You can also check{" "}
            <Link href="/messages" className="text-primary underline underline-offset-2">
              all messages
            </Link>{" "}
            for any existing conversation.
          </p>
        )}

        {!conversationId && variant === "buyer" && (
          <p className="text-sm text-muted-foreground">
            {canStartFromOrder ? (
              <>
                Coordinate pickup or shipping with {counterpartyName} below. You can also check{" "}
                <Link href="/messages" className="text-primary underline underline-offset-2">
                  all messages
                </Link>{" "}
                for an existing thread.
              </>
            ) : (
              <>
                Open{" "}
                <Link href="/messages" className="text-primary underline underline-offset-2">
                  all messages
                </Link>{" "}
                to message the seller.
              </>
            )}
          </p>
        )}

        {conversationId && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello below.</p>
        )}

        {conversationId && messages.length > 0 && (
          <ul className="space-y-3 max-h-72 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
            {messages.map((m) => {
              const fromSelf = m.sender_id === currentUserId
              return (
                <li
                  key={m.id}
                  className={`flex flex-col gap-0.5 ${fromSelf ? "items-end" : "items-start"}`}
                >
                  <span className="text-xs text-muted-foreground">
                    {fromSelf ? "You" : counterpartyName} ·{" "}
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </span>
                  <span
                    className={`max-w-[90%] rounded-lg px-3 py-2 ${
                      fromSelf
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border text-foreground"
                    }`}
                  >
                    {m.content}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {(conversationId || canStartFromOrder) && (
          <div className="space-y-2">
            <Textarea
              placeholder={conversationId ? "Write a reply…" : "Message the seller…"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={sending}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={send} disabled={sending || !body.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
              {conversationId && (
                <Button variant="outline" asChild>
                  <Link href={`/messages/${conversationId}`}>Open full conversation</Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {conversationId && (
          <Button variant="ghost" size="sm" className="px-0 h-auto text-muted-foreground" asChild>
            <Link href="/messages">All messages</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
