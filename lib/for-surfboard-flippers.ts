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
  "For surfers who buy and sell boards. List on Reswell with six months of no selling fees."

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

/** Kept for mobile seller-resource cards. */
export const FOR_SURFBOARD_FLIPPERS_VALUES = [
  {
    key: "fee",
    title: "Six months at 0%",
    body: `We waive the usual ${MARKETPLACE_FEE_PERCENT}% marketplace fee for ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months.`,
  },
  {
    key: "reach",
    title: "Buyers nationwide",
    body: "Pickup or ship. Reach surfers already hunting used boards.",
  },
  {
    key: "flow",
    title: "Buy and sell here",
    body: "Source a board, list the next one, get paid in your wallet.",
  },
] as const

export const FOR_SURFBOARD_FLIPPERS_STEPS = [
  {
    title: "Apply",
    body: "Name and email. We confirm you’re flipping, then unlock the offer.",
  },
  {
    title: "List",
    body: "Post boards free. Photograph deck, bottom, rails, and any dings.",
  },
  {
    title: "Get paid",
    body: "Sales land in your Reswell wallet. Cash out when ready.",
  },
] as const

/** Kept for mobile seller-resource cards. */
export const FOR_SURFBOARD_FLIPPERS_USES = [
  {
    title: "Quiver rotates",
    body: "Boards you’re done with so you can fund the next shape.",
  },
  {
    title: "Deals you picked up",
    body: "Boards you bought to ride or flip.",
  },
  {
    title: "Volume sellers",
    body: "If you buy and sell often, keep the loop moving here.",
  },
] as const

export const FOR_SURFBOARD_FLIPPERS_WHY = {
  title: "One marketplace for surfboards",
  body: "Reswell is built so buying and selling boards doesn’t stop at local pickup. Flippers keep inventory moving — we bring the buyers.",
} as const

export const FOR_SURFBOARD_FLIPPERS_OFFER = {
  title: "Six months. No selling fees.",
  lead: `Usually ${MARKETPLACE_FEE_PERCENT}% when a board sells. For this offer: 0% for ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months.`,
  after: `Afterward, the standard ${MARKETPLACE_FEE_PERCENT}% fee applies (you keep ${SELLER_SHARE_PERCENT}%). Listing stays free.`,
} as const

export type ForSurfboardFlippersFaq = {
  question: string
  answer: string
  href: string
}

export const FOR_SURFBOARD_FLIPPERS_FAQS: readonly ForSurfboardFlippersFaq[] = [
  {
    question: "How do I get 6 months free?",
    answer: `Apply with your name and email. We confirm you’re buying and selling boards, then turn on ${FOR_SURFBOARD_FLIPPERS_OFFER_MONTHS} months of zero marketplace fees.`,
    href: forSurfboardFlippersOfferHref(),
  },
  {
    question: "Why no promo code?",
    answer:
      "Fee waivers are set on your account by Reswell. Applying keeps the offer for real flippers.",
    href: forSurfboardFlippersOfferHref(),
  },
  {
    question: "What does it cost after?",
    answer: `Free to list. After the offer, Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price when a board sells. You keep ${SELLER_SHARE_PERCENT}%.`,
    href: helpArticlePath("selling", "marketplace-fees"),
  },
  {
    question: "How do I get paid?",
    answer:
      "Earnings go to your Reswell wallet. Connect a payout account, then cash out to your bank.",
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
