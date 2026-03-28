"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, MessageCircle, Send } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export type SaleThreadMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
}

export function SaleMessageThread({
  conversationId,
  initialMessages,
  buyerName,
  sellerId,
}: {
  conversationId: string | null
  initialMessages: SaleThreadMessage[]
  buyerName: string
  sellerId: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  async function send() {
    const text = body.trim()
    if (!text || !conversationId) return
    setSending(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Sign in to send a message")
        return
      }
      const { data: inserted, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: text,
        })
        .select("id, content, sender_id, created_at")
        .single()

      if (error) throw error

      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)

      if (inserted) {
        setMessages((prev) => [...prev, inserted])
      }
      setBody("")
      toast.success("Message sent")
    } catch {
      toast.error("Could not send message")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages with {buyerName}
        </CardTitle>
        <CardDescription>
          Recent messages about this listing. Replies go to the same thread as your inbox.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!conversationId && (
          <p className="text-sm text-muted-foreground">
            The buyer hasn&apos;t opened a message thread for this listing yet. When they do, it will
            show up here. You can also check{" "}
            <Link href="/messages" className="text-primary underline underline-offset-2">
              all messages
            </Link>{" "}
            for any existing conversation.
          </p>
        )}

        {conversationId && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello below.</p>
        )}

        {conversationId && messages.length > 0 && (
          <ul className="space-y-3 max-h-72 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
            {messages.map((m) => {
              const fromSeller = m.sender_id === sellerId
              return (
                <li
                  key={m.id}
                  className={`flex flex-col gap-0.5 ${fromSeller ? "items-end" : "items-start"}`}
                >
                  <span className="text-xs text-muted-foreground">
                    {fromSeller ? "You" : buyerName} ·{" "}
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </span>
                  <span
                    className={`max-w-[90%] rounded-lg px-3 py-2 ${
                      fromSeller
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

        {conversationId && (
          <div className="space-y-2">
            <Textarea
              placeholder="Write a reply…"
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
              <Button variant="outline" asChild>
                <Link href={`/messages/${conversationId}`}>Open full conversation</Link>
              </Button>
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
