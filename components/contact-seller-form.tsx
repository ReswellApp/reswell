"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { MessageSquare, Send } from "lucide-react"
import Link from "next/link"

interface ContactSellerFormProps {
  listingId: string
  sellerId: string
  listingTitle: string
  isLoggedIn: boolean
  /** Used for shipping-only; surfboards for pickup. Affects quick-message options. */
  section?: "used" | "surfboards"
}

export function ContactSellerForm({
  listingId,
  sellerId,
  listingTitle,
  isLoggedIn,
  section = "surfboards",
}: ContactSellerFormProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const quickMessages =
    section === "used"
      ? [
          "Hi, is this still available?",
          "What's the lowest you'll accept?",
          "Can I see more photos?",
          "When can you ship?",
        ]
      : [
          "Hi, is this still available?",
          "What's the lowest you'll accept?",
          "Can I see more photos?",
          "Where can we meet for pickup?",
        ]

  async function handleSend() {
    if (!message.trim()) {
      toast.error("Please enter a message")
      return
    }

    setSending(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("Please sign in to send messages")
        router.push("/auth/login")
        return
      }

      // Find or create conversation (buyer = current user, seller = listing owner)
      let { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("seller_id", sellerId)
        .eq("listing_id", listingId)
        .single()

      if (!conversation) {
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            buyer_id: user.id,
            seller_id: sellerId,
            listing_id: listingId,
          })
          .select("id")
          .single()

        if (convError) throw convError
        conversation = newConversation
      }

      // Send message
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: message,
        })

      if (msgError) throw msgError

      toast.success("Message sent!")
      setMessage("")
      router.push(`/messages/${conversation.id}`)
    } catch {
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="text-center py-4">
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">Sign in to contact the seller</p>
        <Button asChild>
          <Link href={`/auth/login?redirect=/used/${listingId}`}>
            Sign In to Message
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Contact Seller</h3>
      
      {/* Quick Messages */}
      <div className="flex flex-wrap gap-2">
        {quickMessages.map((quick) => (
          <Button
            key={quick}
            variant="outline"
            size="sm"
            className="text-xs bg-transparent"
            onClick={() => setMessage(quick)}
          >
            {quick}
          </Button>
        ))}
      </div>

      <Textarea
        placeholder={`Ask about "${listingTitle}"...`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
      />

      <Button onClick={handleSend} disabled={sending || !message.trim()} className="w-full">
        {sending ? (
          "Sending..."
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </>
        )}
      </Button>
    </div>
  )
}
