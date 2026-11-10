import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { helpArticlePath } from "@/lib/help-center/paths"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

export const FOR_SURFBOARD_FLIPPERS_PATH = "/for-surfboard-flippers"
export const FOR_SURFBOARD_FLIPPERS_PAGE_KEY = "for-surfboard-flippers"
export const FOR_SURFBOARD_FLIPPERS_OFFER_ANCHOR = "claim-offer"

/** Legacy shop acquisition URL — permanently redirected to the flippers page. */
export const FOR_SURF_SHOPS_LEGACY_PATH = "/for-surf-shops"

/** Flipper acquisition offer — fee waiver granted by Reswell after apply. */
export const FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS = 6

export const FOR_SURFBOARD_FLIPPERS_TITLE =
  "Surfboard flippers: 6 months no selling fees | Reswell"

export const FOR_SURFBOARD_FLIPPERS_DESCRIPTION = `Surfers who buy and sell boards: flip on Reswell with ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months of zero marketplace fees. Apply once — we set up the offer.`

export const FOR_SURFBOARD_FLIPPERS_HERO_DESCRIPTION =
  "Reswell is the marketplace for buying and selling surfboards. Built for surfers who rotate quivers, hunt deals, and move boards often — try it with six months of no selling fees."

export function forSurfboardFlippersOfferHref(): string {
  return `${FOR_SURFBOARD_FLIPPERS_PATH}#${FOR_SURFBOARD_FLIPPERS_OFFER_ANCHOR}`
}

export function forSurfboardFlippersOfferLabel(): string {
  return "Claim 6 months free"
}

export function forSurfboardFlippersAccountHref(signedIn: boolean): string {
  if (signedIn) return SURFBOARD_SELL_BOARDS_CREATE_HREF
  return authLandingHref("/auth/sign-up", SURFBOARD_SELL_BOARDS_CREATE_HREF)
}

export function forSurfboardFlippersAccountLabel(signedIn: boolean): string {
  return signedIn ? "List a board" : "Create a free account"
}

export function forSurfboardFlippersSignInHref(): string {
  return authLandingHref("/auth/login", SURFBOARD_SELL_BOARDS_CREATE_HREF)
}

export const FOR_SURFBOARD_FLIPPERS_VALUES = [
  {
    key: "fee",
    title: "Six months at 0%",
    body: `Apply once. We waive the usual ${MARKETPLACE_FEE_PERCENT}% marketplace fee for ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months so you can flip boards on Reswell risk-free.`,
  },
  {
    key: "reach",
    title: "Buyers beyond your zip",
    body: "Local apps keep deals local. Reswell reaches surfers already hunting used boards — pickup or shipped nationwide.",
  },
  {
    key: "flow",
    title: "Buy and sell in one place",
    body: "Source a board, list the next one, get paid in your wallet. Same marketplace for both sides of the flip.",
  },
] as const

export const FOR_SURFBOARD_FLIPPERS_STEPS = [
  {
    title: "Tell us you’re flipping",
    body: "Name, email, city — that’s it. No public promo code; we confirm you’re actively buying and selling, then turn the offer on.",
  },
  {
    title: "We unlock zero selling fees",
    body: `Reswell sets ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months of no marketplace fee on your seller account. You keep 100% of the item price while the offer runs.`,
  },
  {
    title: "List the boards you move",
    body: "Quiver rotates, project boards, deals you picked up. Free to post. Photograph deck, bottom, rails, and any dings.",
  },
  {
    title: "Sell, then get paid in your wallet",
    body: "When a board sells, earnings go to your Reswell wallet. Connect a bank account and cash out when the sale is ready.",
  },
] as const

export const FOR_SURFBOARD_FLIPPERS_USES = [
  {
    title: "Quiver rotates",
    body: "Boards you’re done with so you can fund the next shape.",
  },
  {
    title: "Deals you picked up",
    body: "Boards you bought to ride or flip — listed where buyers are already searching.",
  },
  {
    title: "Volume sellers",
    body: "If you buy and sell often, Reswell is built to keep that loop moving.",
  },
] as const

export const FOR_SURFBOARD_FLIPPERS_WHY = {
  eyebrow: "Why Reswell",
  title: "One place to buy and sell surfboards",
  body: [
    "Some boards move fine on Facebook Marketplace or Craigslist. Others sit for months — while someone a few towns over is hunting that exact shape.",
    "Reswell was built so buying and selling surfboards does not stop at local pickup. One dedicated marketplace for boards and gear, with shipping when meetup is not the right fit.",
    "Surfboard flippers are part of that. You already hunt deals and rotate boards. Reswell gives those boards a wider audience — and gives you a place to source the next one.",
  ],
} as const

export const FOR_SURFBOARD_FLIPPERS_FIT = {
  eyebrow: "Flippers on Reswell",
  title: "How flippers fit the marketplace",
  lead: "Reswell connects surfers who want a specific board with people who have one. Flippers keep inventory moving — the marketplace brings demand both ways.",
  points: [
    {
      title: "Buy, then sell again",
      body: "Find a board, ride it or flip it, list the next one. One account for both sides of the deal.",
    },
    {
      title: "Pickup or ship",
      body: "Offer local pickup, shipping, or both. You choose per listing — buyers pay shipping at checkout.",
    },
    {
      title: "Same Sell flow",
      body: "No special account type. Sign up, list from Sell, and apply for the six-month fee offer if you move boards often.",
    },
  ],
} as const

export const FOR_SURFBOARD_FLIPPERS_OFFER = {
  eyebrow: "Flipper offer",
  title: "Six months. No selling fees.",
  lead: `Normally Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price when a board sells (you keep ${SELLER_SHARE_PERCENT}%). For surfers who buy and sell on this offer, we waive that fee for ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months so you can demo the marketplace with real flips.`,
  after: `After the ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months, the standard ${MARKETPLACE_FEE_PERCENT}% marketplace fee applies. Listing stays free either way. Shipping is buyer-paid and never part of the fee.`,
} as const

export type ForSurfboardFlippersFaq = {
  question: string
  answer: string
  href: string
}

export const FOR_SURFBOARD_FLIPPERS_FAQS: readonly ForSurfboardFlippersFaq[] = [
  {
    question: "How do I get the 6 months with no selling fees?",
    answer: `Apply on this page with your name, email, and city. There is no public promo code. A Reswell teammate confirms you’re a surfer who buys and sells boards, then turns on ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months of zero marketplace fees on your seller account.`,
    href: forSurfboardFlippersOfferHref(),
  },
  {
    question: "Why not just publish a promo code?",
    answer:
      "Seller fee waivers are set on your account by Reswell. A public code would be easy to abuse. Applying first keeps the offer for flippers who are ready to list.",
    href: forSurfboardFlippersOfferHref(),
  },
  {
    question: "Do I need a special account?",
    answer:
      "No. Flippers use the same free Reswell account as any seller. Sign up, list boards from Sell, and apply for the offer so we can attach the fee waiver.",
    href: helpArticlePath("selling", "how-to-list-a-board"),
  },
  {
    question: "What does it cost after the offer?",
    answer: `It is always free to list. When a board sells after the offer ends, Reswell takes a ${MARKETPLACE_FEE_PERCENT}% marketplace fee on the item price. You keep ${SELLER_SHARE_PERCENT}%. Buyer-paid shipping is not included in that fee, and card processing is not deducted from your payout.`,
    href: helpArticlePath("selling", "marketplace-fees"),
  },
  {
    question: "Can someone pick the board up locally?",
    answer:
      "Yes. Each listing can offer local pickup, shipping, or both. Pickup-only is fine if you do not want to ship.",
    href: helpArticlePath("selling", "how-to-list-a-board"),
  },
  {
    question: "How do I get paid?",
    answer:
      "Earnings go to your Reswell wallet after the sale reaches the payout state. Connect a payout account, then cash out to your bank.",
    href: helpArticlePath("selling", "how-long-to-get-paid"),
  },
]

export function forSurfboardFlippersFaqStructuredData(): {
  "@context": "https://schema.org"
  "@type": "FAQPage"
  mainEntity: {
    "@type": "Question"
    name: string
    acceptedAnswer: { "@type": "Answer"; text: string }
  }[]
} {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FOR_SURFBOARD_FLIPPERS_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}
