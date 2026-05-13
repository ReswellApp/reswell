import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CircleHelp } from "lucide-react"
import { pageSeoMetadata } from "@/lib/site-metadata"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"

export const metadata = pageSeoMetadata({
  title: "FAQ — Reswell",
  description:
    "Frequently asked questions about buying, selling, fees, shipping, messages, and Purchase Protection on Reswell.",
  path: "/faq",
})

type Faq = {
  question: string
  answer: React.ReactNode
}

type FaqSection = {
  id: string
  title: string
  description?: string
  faqs: Faq[]
}

const sections: FaqSection[] = [
  {
    id: "buying",
    title: "Buying on Reswell",
    description: "How to find a board, make an offer, and check out.",
    faqs: [
      {
        question: "How do I buy a board?",
        answer: (
          <>
            Browse boards from the{" "}
            <Link href="/boards" className="text-primary underline">
              Surfboards
            </Link>{" "}
            page, open a listing you like, and hit{" "}
            <strong className="text-foreground">Buy now</strong> to check out. If you want to ask
            the seller something first, tap <strong className="text-foreground">Message seller</strong>.
            Payment always happens inside Reswell checkout. We don&apos;t process payments outside
            the app.
          </>
        ),
      },
      {
        question: "Can I make an offer?",
        answer: (
          <>
            If the seller has offers turned on for a listing, you&apos;ll see a{" "}
            <strong className="text-foreground">Make an offer</strong> button on the listing page.
            Send your price and the seller can accept, counter, or decline in Messages. Once an
            offer is accepted, we&apos;ll send you a checkout link so you can pay at the agreed
            price.
          </>
        ),
      },
      {
        question: "Local pickup or shipping, how do I know which a listing offers?",
        answer: (
          <>
            Every listing tells you whether the seller offers local pickup, shipping, or both. For
            shipped purchases, the seller adds tracking once the board is on its way. For pickup, you
            and the seller sort out a time and place in Messages. It&apos;s worth reading our{" "}
            <Link href="/safety" className="text-primary underline">
              Safety tips
            </Link>{" "}
            before you meet up.
          </>
        ),
      },
    ],
  },
  {
    id: "selling",
    title: "Selling on Reswell",
    description: "Listing your board, handling offers, and closing the sale.",
    faqs: [
      {
        question: "How do I list a board for sale?",
        answer: (
          <>
            Sign in and tap <strong className="text-foreground">Sell</strong> in the header, or go
            straight to{" "}
            <Link href="/sell" className="text-primary underline">
              /sell
            </Link>
            . Add good photos, your price, the condition, the dimensions (length, width,
            thickness, volume), the fin setup, and whether you want to offer local pickup,
            shipping, or both. Posting a listing is free.
          </>
        ),
      },
      {
        question: "How do I respond to messages and offers?",
        answer: (
          <>
            Buyer messages land in{" "}
            <Link href="/messages" className="text-primary underline">
              Messages
            </Link>
            . Offers show up in the listing thread and also in{" "}
            <Link href="/dashboard/offers" className="text-primary underline">
              Offers
            </Link>{" "}
            in your dashboard, so you can accept, counter, or decline from wherever you are. Quick,
            honest replies keep your listings healthy and help you close the sale.
          </>
        ),
      },
      {
        question: "I sold a board. What happens next?",
        answer: (
          <>
            Open the sale from{" "}
            <Link href="/dashboard/sales" className="text-primary underline">
              Sales
            </Link>
            . If you&apos;re shipping it, pack the board well, use a tracked carrier, and add the
            tracking number to the sale. You can also buy a label straight from the sale page
            when ShipEngine is set up. If it&apos;s local pickup, confirm the meetup in Messages.
            Your earnings land in your wallet once the sale reaches the right state, as laid out
            in{" "}
            <Link href="/protection-policy" className="text-primary underline">
              Purchase Protection
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    id: "payments",
    title: "Payments, fees, and payouts",
    description: "How money moves through Reswell for buyers and sellers.",
    faqs: [
      {
        question: "How do I pay?",
        answer: (
          <>
            Buyers pay by card in Reswell checkout. Our payment processor, Stripe, handles your
            card details directly. If you have a wallet balance from past sales, you can apply it
            toward your purchase at checkout. We don&apos;t accept payments outside of Reswell,
            and payments made outside the app aren&apos;t covered by Purchase Protection.
          </>
        ),
      },
      {
        question: "What is my wallet balance?",
        answer: (
          <>
            Your wallet is where earnings from completed sales show up. You can spend that balance
            on other listings at checkout, or cash out to your payout destination from{" "}
            <Link href="/dashboard/earnings" className="text-primary underline">
              Earnings
            </Link>
            .
          </>
        ),
      },
      {
        question: "What are the fees?",
        answer: (
          <>
            On every completed sale, Reswell takes a {MARKETPLACE_FEE_PERCENT}% marketplace fee
            and the seller keeps {SELLER_SHARE_PERCENT}%. Card processing is not an extra
            deduction on top of that. Reswell absorbs it. There&apos;s no separate Purchase
            Protection fee for sellers either. You can find the full detail in the{" "}
            <Link href="/terms" className="text-primary underline">
              Terms of Service
            </Link>
            .
          </>
        ),
      },
      {
        question: "How do cash outs work?",
        answer: (
          <>
            Once funds are released to your wallet, you can request a cash out from{" "}
            <Link href="/dashboard/earnings" className="text-primary underline">
              Earnings
            </Link>{" "}
            to the payout destination you&apos;ve set up. How long it takes depends on your
            payout method and any checks our provider needs to run. Keep your payout details
            accurate so your transfer doesn&apos;t get held up.
          </>
        ),
      },
    ],
  },
  {
    id: "protection",
    title: "Purchase Protection and problems",
    description: "What's covered on eligible purchases, and how to open a claim if something goes wrong.",
    faqs: [
      {
        question: "What is Reswell Purchase Protection?",
        answer: (
          <>
            Purchase Protection covers buyers on eligible purchases paid through Reswell checkout
            when the item never arrives, turns up damaged, or is materially different from the
            listing. Buyers don&apos;t pay an extra fee for it, and sellers are not charged a
            separate protection deduction. The full policy and exclusions live on the{" "}
            <Link href="/protection-policy" className="text-primary underline">
              Purchase Protection
            </Link>{" "}
            page.
          </>
        ),
      },
      {
        question: "I have a problem with a purchase. What should I do?",
        answer: (
          <>
            Message the other person first. Most issues get sorted out with a quick conversation.
            If you still need help, open the purchase from{" "}
            <Link href="/dashboard/purchases" className="text-primary underline">
              Purchases
            </Link>{" "}
            and tap <strong className="text-foreground">Refund help</strong> to file a claim, or{" "}
            <strong className="text-foreground">Ask Reswell</strong> for a general question about
            the purchase. We aim to review claims within 3 business days.
          </>
        ),
      },
      {
        question: "I think I'm dealing with a scam.",
        answer: (
          <>
            Slow down and keep the conversation in Reswell Messages. Don&apos;t send money outside
            the app. Report the listing or user from the listing page, and{" "}
            <Link href="/contact" className="text-primary underline">
              contact us
            </Link>{" "}
            with any details you have. Our{" "}
            <Link href="/safety" className="text-primary underline">
              Safety tips
            </Link>{" "}
            page covers common red flags worth a read.
          </>
        ),
      },
    ],
  },
  {
    id: "messages",
    title: "Messages and communication",
    faqs: [
      {
        question: "Where do I find my messages?",
        answer: (
          <>
            Open{" "}
            <Link href="/messages" className="text-primary underline">
              Messages
            </Link>{" "}
            (the envelope icon in the header). Every thread is tied to a specific listing or
            purchase, so pickup details, shipping updates, and purchase questions all live in one place.
            Keep the conversation on Reswell so we have a record if you ever need us to step in.
          </>
        ),
      },
    ],
  },
  {
    id: "account",
    title: "Account and settings",
    faqs: [
      {
        question: "How do I change my profile, password, or notifications?",
        answer: (
          <>
            You can update your profile, display name, shop details, and notification preferences
            from{" "}
            <Link href="/dashboard/profile" className="text-primary underline">
              Profile
            </Link>
            . If you&apos;ve forgotten your password, use the reset link on the sign in screen.
            For help with account access or deletion, just{" "}
            <Link href="/contact" className="text-primary underline">
              contact us
            </Link>
            .
          </>
        ),
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <CircleHelp className="h-10 w-10 text-primary" aria-hidden />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Frequently asked questions</h1>
            <p className="text-muted-foreground mt-1">
              Common questions about buying and selling surfboards on Reswell
            </p>
          </div>
        </div>

        <p className="text-muted-foreground leading-relaxed mb-10">
          Can&apos;t find what you&apos;re looking for? Our team reads every message. Start with{" "}
          <Link href="/contact" className="text-primary underline">
            Contact
          </Link>
          , or head to the{" "}
          <Link href="/protection-policy" className="text-primary underline">
            Purchase Protection
          </Link>{" "}
          page if you need to file a refund claim.
        </p>

        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
              <h2
                id={`${section.id}-heading`}
                className="text-xl font-semibold text-foreground mb-1"
              >
                {section.title}
              </h2>
              {section.description && (
                <p className="text-sm text-muted-foreground mb-5">{section.description}</p>
              )}
              <div className="space-y-4">
                {section.faqs.map((faq) => (
                  <Card key={faq.question}>
                    <CardHeader>
                      <CardTitle className="text-base">{faq.question}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <Card className="mt-12 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="font-medium text-foreground">Still need help?</p>
            <p className="text-sm text-muted-foreground mt-1 mb-0 leading-relaxed">
              Take a look at the{" "}
              <Link href="/shipping" className="text-primary underline">
                Shipping guide
              </Link>
              ,{" "}
              <Link href="/safety" className="text-primary underline">
                Safety tips
              </Link>
              , and{" "}
              <Link href="/protection-policy" className="text-primary underline">
                Purchase Protection
              </Link>
              , or{" "}
              <Link href="/contact" className="text-primary underline">
                contact us
              </Link>
              . We read every message.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
