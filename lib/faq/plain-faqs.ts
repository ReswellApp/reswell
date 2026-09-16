/**
 * Plain-text FAQ corpus for retrieval (live chat AI, etc.).
 * Keep aligned with the visible answers on `/faq`.
 */

import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"

export type PlainFaqEntry = {
  id: string
  sectionId: string
  question: string
  answerPlain: string
  href: string
}

export const PLAIN_FAQS: PlainFaqEntry[] = [
  {
    id: "buy-on-reswell",
    sectionId: "buying",
    question: "How do I buy on Reswell?",
    answerPlain:
      "Browse the marketplace (boards, fins, wetsuits, and more), open a listing you like, and hit Buy now to check out. If you want to ask the seller something first, tap Message seller. Payment always happens inside Reswell checkout. We don't process payments outside the app.",
    href: "/faq#buying",
  },
  {
    id: "make-an-offer",
    sectionId: "buying",
    question: "Can I make an offer?",
    answerPlain:
      "If the seller has offers turned on for a listing, you'll see a Make an offer button on the listing page. Send your price and the seller can accept, counter, or decline in Messages. Once an offer is accepted, we'll send you a checkout link so you can pay at the agreed price.",
    href: "/faq#buying",
  },
  {
    id: "pickup-or-shipping",
    sectionId: "buying",
    question: "Local pickup or shipping, how do I know which a listing offers?",
    answerPlain:
      "Every listing tells you whether the seller offers local pickup, shipping, or both. For shipped purchases, the seller adds tracking once the item is on its way. For pickup, you and the seller sort out a time and place in Messages. It's worth reading our Safety tips before you meet up.",
    href: "/faq#buying",
  },
  {
    id: "how-to-list",
    sectionId: "selling",
    question: "How do I list something for sale?",
    answerPlain:
      "Sign in and tap Sell in the header, or go straight to /sell. Choose a category (boards, fins, wetsuits, and more), add good photos, your price, condition, and whether you want to offer local pickup, shipping, or both. Posting a listing is free.",
    href: "/faq#selling",
  },
  {
    id: "respond-messages-offers",
    sectionId: "selling",
    question: "How do I respond to messages and offers?",
    answerPlain:
      "Buyer messages land in Messages. Offers show up in the listing thread and also in Offers in your dashboard, so you can accept, counter, or decline from wherever you are. Quick, honest replies keep your listings healthy and help you close the sale.",
    href: "/faq#selling",
  },
  {
    id: "sale-next-steps",
    sectionId: "selling",
    question: "I made a sale. What happens next?",
    answerPlain:
      "Open the sale from Sales. If you're shipping it, pack the item well, use a tracked carrier, and add the tracking number to the sale. You can also buy a label straight from the sale page when ShipEngine is set up. If it's local pickup, confirm the meetup in Messages. Your earnings land in your wallet once the sale reaches the right state, as laid out in Purchase Protection.",
    href: "/faq#selling",
  },
  {
    id: "how-to-pay",
    sectionId: "payments",
    question: "How do I pay?",
    answerPlain:
      "Buyers pay by card in Reswell checkout. Our payment processor, Stripe, handles your card details directly. If you have a wallet balance from past sales, you can apply it toward your purchase at checkout. We don't accept payments outside of Reswell, and payments made outside the app aren't covered by Purchase Protection.",
    href: "/faq#payments",
  },
  {
    id: "wallet-balance",
    sectionId: "payments",
    question: "What is my wallet balance?",
    answerPlain:
      "Your wallet is where earnings from completed sales show up. You can spend that balance on other listings at checkout, or cash out to your payout destination from Earnings.",
    href: "/faq#payments",
  },
  {
    id: "fees",
    sectionId: "payments",
    question: "What are the fees?",
    answerPlain: `On every completed sale, Reswell takes a ${MARKETPLACE_FEE_PERCENT}% marketplace fee and the seller keeps ${SELLER_SHARE_PERCENT}%. Card processing is not an extra deduction on top of that—Reswell absorbs it. There's no separate Purchase Protection fee for sellers either. You can find the full detail in the Terms of Service.`,
    href: "/faq#payments",
  },
  {
    id: "cash-outs",
    sectionId: "payments",
    question: "How do cash outs work?",
    answerPlain:
      "Once funds are released to your wallet, you can request a cash out from Earnings to the payout destination you've set up. How long it takes depends on your payout method and any checks our provider needs to run. Keep your payout details accurate so your transfer doesn't get held up.",
    href: "/faq#payments",
  },
  {
    id: "purchase-protection",
    sectionId: "protection",
    question: "What is Reswell Purchase Protection?",
    answerPlain:
      "Purchase Protection covers buyers on eligible purchases paid through Reswell checkout when the item never arrives, turns up damaged, or is materially different from the listing. Buyers don't pay an extra fee for it, and sellers are not charged a separate protection deduction. The full policy and exclusions live on the Purchase Protection page.",
    href: "/faq#protection",
  },
  {
    id: "purchase-problem",
    sectionId: "protection",
    question: "I have a problem with a purchase. What should I do?",
    answerPlain:
      "Message the other person first. Most issues get sorted out with a quick conversation. If you still need help, open the purchase from Purchases and tap Refund help to file a claim, or Ask Reswell for a general question about the purchase. We aim to review claims within 3 business days.",
    href: "/faq#protection",
  },
  {
    id: "scam",
    sectionId: "protection",
    question: "I think I'm dealing with a scam.",
    answerPlain:
      "Slow down and keep the conversation in Reswell Messages. Don't send money outside the app. Report the listing or user from the listing page, and contact us with any details you have. Our Safety tips page covers common red flags worth a read.",
    href: "/faq#protection",
  },
  {
    id: "find-messages",
    sectionId: "messages",
    question: "Where do I find my messages?",
    answerPlain:
      "Open Messages (the envelope icon in the header). Every thread is tied to a specific listing or purchase, so pickup details, shipping updates, and purchase questions all live in one place. Keep the conversation on Reswell so we have a record if you ever need us to step in.",
    href: "/faq#messages",
  },
  {
    id: "account-settings",
    sectionId: "account",
    question: "How do I change my profile, password, or notifications?",
    answerPlain:
      "You can update your profile, display name, shop details, and notification preferences from Profile. If you've forgotten your password, use the reset link on the sign in screen. For help with account access or deletion, just contact us.",
    href: "/faq#account",
  },
]
