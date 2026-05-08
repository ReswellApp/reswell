"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { sendListingMessage } from "@/app/actions/messages"
import { MESSAGE_BLOCKED_PHONE_ERROR } from "@/lib/messages/policy-errors"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { MessageSquare, Send } from "lucide-react"
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
  /** When true, no in-form section title is shown (parent already provides the label). */
  hideSectionTitle?: boolean
}

export function ContactSellerForm({
  listingId,
  listingSlug,
  sellerId,
  listingTitle,
  isLoggedIn,
  section = "surfboards",
  shippingAvailable = false,
  hideSectionTitle = false,
}: ContactSellerFormProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const router = useRouter()
  const openSignIn = useSignInGate()
  const listingReturnPath = listingDetailHref({ id: listingId, slug: listingSlug, section })

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
          openSignIn(listingReturnPath)
          return
        }
        if (result.error === MESSAGE_BLOCKED_PHONE_ERROR) {
          return
        }
        throw new Error(result.error)
      }

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
      <div className="py-6 text-center">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-foreground" aria-hidden />
        <p className="mb-5 text-[16px] text-foreground">Sign in to contact the seller</p>
        <Button
          type="button"
          className="rounded-full px-8"
          onClick={() => openSignIn(listingReturnPath)}
        >
          Sign In to Message
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!hideSectionTitle ? (
        <h3 className="font-headline text-[1.3125rem] font-semibold tracking-tight text-foreground">
          Contact seller
        </h3>
      ) : null}

      {/* Quick Messages */}
      <div className="flex flex-wrap gap-2">
        {quickMessages.map((quick) => (
          <Button
            key={quick}
            variant="outline"
            size="sm"
            className="rounded-full border-border/60 bg-background text-[14px] font-normal text-foreground shadow-none hover:bg-muted/60"
            onClick={() => setMessage(quick)}
          >
            {quick}
          </Button>
        ))}
      </div>

      <Textarea
        placeholder={`Ask about "${listingTitle}"…`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="rounded-2xl border-border/60 bg-background text-[16px] text-foreground shadow-none placeholder:text-foreground/75 transition-colors focus-visible:ring-[1.5px]"
      />

      <Button
        variant="outline"
        onClick={handleSend}
        disabled={sending || !message.trim()}
        className="w-full rounded-full border-foreground/25 text-foreground shadow-sm hover:bg-muted/50"
      >
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
