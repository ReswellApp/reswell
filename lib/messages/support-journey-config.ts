import type { MessagesSupportTopic } from "@/lib/validations/messagesSupportTicket"
import { messagesSupportTopicLabels } from "@/lib/validations/messagesSupportTicket"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"

/**
 * Self-serve support tree shown before free-form contact. Copy stays short; link out to the FAQ where possible.
 */
export type SupportJourneyNode = {
  id: string
  title: string
  hint?: string
  /** Plain-text answer shown when the user picks this path. */
  resolution?: string
  helpHref?: string
  helpLinkLabel?: string
  choices?: SupportJourneyNode[]
}

function n(partial: SupportJourneyNode): SupportJourneyNode {
  return partial
}

export const SUPPORT_JOURNEY_BY_TOPIC: Record<MessagesSupportTopic, SupportJourneyNode[]> = {
  general: [
    n({
      id: "gen-buying-101",
      title: "I'm new — how do I buy?",
      hint: "Browse, message, checkout",
      resolution:
        "Browse the marketplace (boards, fins, wetsuits, and more), open a listing you like, and use Message seller if you have questions. When you're ready, pay only through Reswell checkout so your order is covered by Purchase Protection. We never recommend paying outside the app.",
      helpHref: "/faq#buying",
      helpLinkLabel: "Buying FAQ",
    }),
    n({
      id: "gen-selling-101",
      title: "I'm new — how do I sell?",
      hint: "List, offers, ship or pickup",
      resolution:
        "Tap Sell to create a listing with clear photos and accurate dimensions. Buyers may message you or make offers—reply and accept from Messages or your Offers dashboard. After a sale, you'll fulfill from your Sales dashboard (shipping label or pickup).",
      helpHref: "/faq#selling",
      helpLinkLabel: "Selling FAQ",
    }),
    n({
      id: "gen-fees",
      title: "Fees, checkout & pricing",
      hint: "What Reswell charges",
      resolution:
        `Buyers pay by card in Reswell checkout. When a sale completes, Reswell keeps a ${MARKETPLACE_FEE_PERCENT}% marketplace fee on the sale total and the seller receives ${SELLER_SHARE_PERCENT}%. Card processing is not deducted from the seller’s payout—Reswell absorbs that cost. Paying inside Reswell is what makes an order eligible for Purchase Protection and for our team to help if something goes wrong.`,
      helpHref: "/faq#payments",
      helpLinkLabel: "Payments & fees FAQ",
    }),
    n({
      id: "gen-msgs",
      title: "Messages & notifications",
      hint: "Where threads live",
      resolution:
        "All listing and order conversations live under Messages. Keep chat on Reswell so there's a record—we can't verify deals made off-platform.",
      helpHref: "/faq#messages",
      helpLinkLabel: "Messages FAQ",
    }),
    n({
      id: "gen-freeform",
      title: "My question isn’t listed",
      hint: "Message our team",
    }),
  ],

  account: [
    n({
      id: "acct-profile",
      title: "Profile, email & sign-in",
      hint: "Password reset & settings",
      resolution:
        "Update your profile from Dashboard → Profile. Use the sign-in screen to reset your password if you're locked out. For unusual login issues, choose “I still need help” below—we'll verify with you securely.",
      helpHref: "/faq#account",
      helpLinkLabel: "Account FAQ",
    }),
    n({
      id: "acct-earnings",
      title: "Earnings, payouts & wallet",
      hint: "Wallet & cash out",
      resolution:
        "After a sale completes, earnings flow to your wallet. Open Dashboard → Earnings to connect a payout method, cash out, or track transfers. Delays are often from bank or verification steps—details you entered must match your account.",
      helpHref: "/dashboard/earnings",
      helpLinkLabel: "Open Earnings",
    }),
    n({
      id: "acct-shop",
      title: "Shop or seller profile",
      hint: "Verified shop, branding",
      resolution:
        "Shop name, logo, and verification appear on your public profile and listings. Update them from Profile; if something looks wrong after saving, tell us what you expected to see.",
      helpHref: "/dashboard/profile",
      helpLinkLabel: "Open Profile",
    }),
    n({
      id: "acct-delete",
      title: "Delete my account or data",
      hint: "Privacy requests",
      resolution:
        "We take account deletion and data requests seriously. Send a ticket with the email on your account and what you need—we’ll confirm identity before processing.",
    }),
    n({
      id: "acct-freeform",
      title: "Something else about my account",
      hint: "Contact support",
    }),
  ],

  buying_selling: [
    n({
      id: "bs-offers",
      title: "Offers, counters & negotiation",
      hint: "Make offer, accept, decline",
      resolution:
        "If the listing allows offers, use Make an offer from the listing page. The seller can accept, counter, or decline—all in Messages. After acceptance, complete checkout at the agreed price. Don't arrange payment off-platform.",
      helpHref: "/faq#buying",
      helpLinkLabel: "Buying FAQ",
    }),
    n({
      id: "bs-ship-pickup",
      title: "Shipping vs local pickup",
      hint: "Tracking & meetups",
      resolution:
        "Listings show whether shipping, pickup, or both are available. For shipped orders, the seller provides tracking in the order. For pickup, agree on time and place in Messages—see our Safety tips before meeting someone you don't know.",
      choices: [
        n({
          id: "bs-ship-tracking",
          title: "Tracking or delivery problem",
          resolution:
            "Open the order from Dashboard → Orders and check the tracking the seller added. Message the seller first; if the package is stuck or missing, use Refund help on the order or ask us from this chat.",
          helpHref: "/faq#buying",
          helpLinkLabel: "Buying help",
        }),
        n({
          id: "bs-pickup-safety",
          title: "Pickup safety & meetups",
          resolution:
            "Meet in public, bring a friend when you can, and inspect the item before you leave. Never pay cash off-platform for something that was supposed to go through checkout.",
          helpHref: "/safety",
          helpLinkLabel: "Safety tips",
        }),
      ],
    }),
    n({
      id: "bs-order-after",
      title: "Order after checkout",
      hint: "Status, not as described",
      resolution:
        "Paid orders appear under Orders (buyer) or Sales (seller). If something's wrong—damage, wrong item, no tracking—open the order and use Refund help or Ask Reswell. Most issues are fastest when buyer and seller talk first.",
      helpHref: "/protection-policy",
      helpLinkLabel: "Purchase Protection",
    }),
    n({
      id: "bs-listing",
      title: "Listing visibility, edits, or removal",
      hint: "My listing isn’t right on the site",
      resolution:
        "Edit the listing from your dashboard. If it violates guidelines or you see another listing that does, use report flows on the listing page and tell us what’s wrong.",
    }),
    n({
      id: "bs-freeform",
      title: "None of these — I’ll describe it",
      hint: "Free-form message",
    }),
  ],

  payments: [
    n({
      id: "pay-checkout",
      title: "Checkout failed or charge question",
      hint: "Card & checkout",
      resolution:
        "Checkout is powered by Stripe; cards are never stored on our servers. If a charge failed, try another card or bank. If you see a charge you don't recognize, tell us the date and amount—we'll match it to an order.",
      helpHref: "/faq#payments",
      helpLinkLabel: "Payments FAQ",
    }),
    n({
      id: "pay-wallet",
      title: "Wallet balance",
      hint: "Spend at checkout or cash out",
      resolution:
        "Money in your wallet comes from completed sales or credits. You can apply it toward purchases at checkout or cash out from Earnings after connecting a payout method. Timing depends on your bank and verification.",
      helpHref: "/faq#payments",
      helpLinkLabel: "Wallet & fees FAQ",
    }),
    n({
      id: "pay-payout-delay",
      title: "Payout delayed or missing",
      hint: "Transfers & holds",
      resolution:
        "Payouts can pause if details need verification or the order isn't in a payable state yet. Check Earnings for status and messages from us. Include your order number when you contact support.",
      helpHref: "/dashboard/earnings",
      helpLinkLabel: "Open Earnings",
    }),
    n({
      id: "pay-fees",
      title: "Fee breakdown on a sale",
      hint: "What you keep",
      resolution:
        `Each completed sale has one marketplace fee: Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the sale price and you keep ${SELLER_SHARE_PERCENT}%. That’s already reflected when you price a listing and again before you cash out. Card processing isn’t an extra deduction from sellers—see our FAQ or Terms for the full picture.`,
      helpHref: "/faq#payments",
      helpLinkLabel: "Fees FAQ",
    }),
    n({
      id: "pay-freeform",
      title: "Another payment or payout issue",
      hint: "Contact finance support",
    }),
  ],

  safety: [
    n({
      id: "safe-scam",
      title: "Scam, fraud, or off-platform payment",
      hint: "Urgent — don't pay outside Reswell",
      resolution:
        "Stop if someone asks you to pay by wire, gift cards, or a link outside checkout. Keep proof in Messages, don't send more money, and use this form to tell us who, what listing, and what they asked you to do.",
      helpHref: "/safety",
      helpLinkLabel: "Safety tips",
    }),
    n({
      id: "safe-meetup",
      title: "Unsafe meetup or harassment",
      hint: "In-person or messages",
      resolution:
        "If you feel unsafe, disengage and get to a safe place. For serious threats, contact local authorities. On Reswell, report the user or listing and send us screenshots—our team reviews safety reports as a priority.",
      helpHref: "/safety",
      helpLinkLabel: "Safety tips",
    }),
    n({
      id: "safe-community",
      title: "Abusive messages or harassment",
      hint: "Report & block",
      resolution:
        "You can report concerning behavior from the conversation or listing. Include what happened and when—we may restrict accounts that violate community expectations.",
    }),
    n({
      id: "safe-freeform",
      title: "Something else — safety or trust",
      hint: "Describe the situation",
    }),
  ],

  other: [
    n({
      id: "other-freeform",
      title: "Describe your question",
      hint: "Anything that doesn’t fit the categories above",
    }),
  ],
}

export function journeyOptionsForTopic(topic: MessagesSupportTopic): SupportJourneyNode[] {
  return SUPPORT_JOURNEY_BY_TOPIC[topic]
}

export function formatTicketDetailsWithJourney(
  topic: MessagesSupportTopic,
  pathTitles: string[],
  userDetails: string,
): string {
  const topicLabel = messagesSupportTopicLabels[topic]
  const path =
    pathTitles.length > 0 ? `${topicLabel} → ${pathTitles.join(" → ")}` : topicLabel
  const body = userDetails.trim()
  return [`Topic: ${topicLabel}`, `Path: ${path}`, "", body].join("\n")
}

export function journeyNodeShowsResolution(node: SupportJourneyNode): boolean {
  return Boolean(node.resolution?.trim())
}
