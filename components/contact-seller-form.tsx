"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { sendListingMessage } from "@/app/actions/messages"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { MessageSquare, Send } from "lucide-react"
import Link from "next/link"
import { listingDetailHref } from "@/lib/listing-href"

interface ContactSellerFormProps {
  listingId: string
  listingSlug?: string | null
  sellerId: string
  listingTitle: string
  isLoggedIn: boolean
  /** Surfboard listings: shipping vs local pickup affects quick-message options. */
  section?: "surfboards"
  /** Surfboards: seller offers shipping (shows shipping-related quick prompts). */
  shippingAvailable?: boolean
}

export function ContactSellerForm({
  listingId,
  listingSlug,
  sellerId,
  listingTitle,
  isLoggedIn,
  section = "surfboards",
  shippingAvailable = false,
}: ContactSellerFormProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const router = useRouter()

  const quickMessages = shippingAvailable
    ? [
        "Hi, is this still available?",
        "What's the lowest you'll accept?",
        "Can I see more photos?",
        "Where can we meet for pickup?",
        "Can you ship this board to me?",
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
      const result = await sendListingMessage({
        listing_id: listingId,
        seller_id: sellerId,
        content: message,
      })

      if ("error" in result) {
        if (result.error === "Unauthorized") {
          toast.error("Please sign in to send messages")
          router.push("/auth/login")
          return
        }
        throw new Error(result.error)
      }

      toast.success("Message sent!")
      setMessage("")
      router.push(`/messages/${result.conversation_id}`)
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
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(
              listingDetailHref({ id: listingId, slug: listingSlug, section }),
            )}`}
          >
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
