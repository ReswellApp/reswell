import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { helpArticlePath } from "@/lib/help-center/paths"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

export const FOR_SURF_SHOPS_PATH = "/for-surf-shops"
export const FOR_SURF_SHOPS_PAGE_KEY = "for-surf-shops"
export const FOR_SURF_SHOPS_OFFER_ANCHOR = "claim-offer"

/** Shop acquisition offer — fee waiver granted by Reswell after apply. */
export const FOR_SURF_SHOPS_OFFER_MONTHS = 6

export const FOR_SURF_SHOPS_TITLE =
  "Surf shops: 6 months no selling fees | Reswell"

export const FOR_SURF_SHOPS_DESCRIPTION = `Surf shops: list trade-ins and used boards on Reswell with ${FOR_SURF_SHOPS_OFFER_MONTHS} months of zero marketplace fees. Apply once — we set up the shop offer.`

export const FOR_SURF_SHOPS_HERO_DESCRIPTION =
  "Reswell is the marketplace for buying and selling surfboards. Put your shop's used rack in front of buyers nationwide — and try it with six months of no selling fees."

export function forSurfShopsOfferHref(): string {
  return `${FOR_SURF_SHOPS_PATH}#${FOR_SURF_SHOPS_OFFER_ANCHOR}`
}

export function forSurfShopsOfferLabel(): string {
  return "Claim 6 months free"
}

export function forSurfShopsAccountHref(signedIn: boolean): string {
  if (signedIn) return SURFBOARD_SELL_BOARDS_CREATE_HREF
  return authLandingHref("/auth/sign-up", SURFBOARD_SELL_BOARDS_CREATE_HREF)
}

export function forSurfShopsAccountLabel(signedIn: boolean): string {
  return signedIn ? "List a used board" : "Create a free account"
}

export function forSurfShopsSignInHref(): string {
  return authLandingHref("/auth/login", SURFBOARD_SELL_BOARDS_CREATE_HREF)
}

export const FOR_SURF_SHOPS_VALUES = [
  {
    key: "fee",
    title: "Six months at 0%",
    body: `Apply once. We waive the usual ${MARKETPLACE_FEE_PERCENT}% marketplace fee for ${FOR_SURF_SHOPS_OFFER_MONTHS} months so your shop can try Reswell risk-free.`,
  },
  {
    key: "reach",
    title: "Buyers beyond your zip",
    body: "Local racks stay local. Reswell reaches surfers who are already hunting used boards — pickup at the shop or shipped.",
  },
  {
    key: "shop",
    title: "Your shop, on the marketplace",
    body: "Use your shop name as the seller. Listings, reviews, and a public seller page live in one place buyers can follow.",
  },
] as const

export const FOR_SURF_SHOPS_STEPS = [
  {
    title: "Tell us about your shop",
    body: "Shop name, email, city — that’s it. No public promo code; we confirm real shops and turn the offer on.",
  },
  {
    title: "We unlock zero selling fees",
    body: `Reswell sets ${FOR_SURF_SHOPS_OFFER_MONTHS} months of no marketplace fee on your seller account. You keep 100% of the item price while the offer runs.`,
  },
  {
    title: "List the used rack",
    body: "Trade-ins, demos, boards in the back. Free to post. Photograph deck, bottom, rails, and any dings.",
  },
  {
    title: "Sell, then get paid in your wallet",
    body: "When a board sells, earnings go to your Reswell wallet. Connect a bank account and cash out when the sale is ready.",
  },
] as const

export const FOR_SURF_SHOPS_USES = [
  {
    title: "Trade-ins",
    body: "Boards you took on trade that are waiting in the back.",
  },
  {
    title: "Used boards you took in",
    body: "The used rack, listed where buyers are already shopping used boards.",
  },
  {
    title: "Demos and rentals",
    body: "Boards you are done riding in the shop and ready to move.",
  },
] as const

export const FOR_SURF_SHOPS_WHY = {
  eyebrow: "Why Reswell",
  title: "One place to buy and sell surfboards",
  body: [
    "Some boards move fine on Facebook Marketplace or Craigslist. Others sit for months — while someone a few towns over is hunting that exact shape.",
    "Reswell was built so buying and selling surfboards does not stop at local pickup. One dedicated marketplace for boards and gear, with shipping when meetup is not the right fit.",
    "Surf shops are part of that. You already take trade-ins and run a used rack. Reswell gives those boards a wider audience without asking you to rebuild your storefront.",
  ],
} as const

export const FOR_SURF_SHOPS_FIT = {
  eyebrow: "Your shop on Reswell",
  title: "How shops fit the marketplace",
  lead: "Reswell connects surfers who want a specific board with people who have one. Shops bring inventory, trust, and local pickup — the marketplace brings demand.",
  points: [
    {
      title: "Inventory that should move",
      body: "Trade-ins and used boards should not gather dust in the back. List them once and reach buyers who are already searching.",
    },
    {
      title: "Pickup at the counter",
      body: "Offer local pickup, shipping, or both. Shoppers can grab the board from you or have it shipped — you choose per listing.",
    },
    {
      title: "Same Sell flow, shop identity",
      body: "No special account type to learn. Sign up, set your shop name as the display name, and list from Sell like any seller.",
    },
  ],
} as const

export const FOR_SURF_SHOPS_OFFER = {
  eyebrow: "Shop offer",
  title: "Six months. No selling fees.",
  lead: `Normally Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price when a board sells (you keep ${SELLER_SHARE_PERCENT}%). For shops in this offer, we waive that fee for ${FOR_SURF_SHOPS_OFFER_MONTHS} months so you can demo the marketplace with real inventory.`,
  after: `After the ${FOR_SURF_SHOPS_OFFER_MONTHS} months, the standard ${MARKETPLACE_FEE_PERCENT}% marketplace fee applies. Listing stays free either way. Shipping is buyer-paid and never part of the fee.`,
} as const

export type ForSurfShopsFaq = {
  question: string
  answer: string
  href: string
}

export const FOR_SURF_SHOPS_FAQS: readonly ForSurfShopsFaq[] = [
  {
    question: "How do I get the 6 months with no selling fees?",
    answer: `Apply on this page with your shop details. There is no public promo code — that would get shared beyond real shops. A Reswell teammate confirms your shop and turns on ${FOR_SURF_SHOPS_OFFER_MONTHS} months of zero marketplace fees on your seller account.`,
    href: forSurfShopsOfferHref(),
  },
  {
    question: "Why not just publish a promo code?",
    answer:
      "Seller fee waivers are set on the shop's account by Reswell. A public code would be hard to limit to real shops and easy to abuse. Applying first keeps the offer for surf shops that are ready to list used boards.",
    href: forSurfShopsOfferHref(),
  },
  {
    question: "Do surf shops need a special account?",
    answer:
      "No. Shops use the same free Reswell account as any seller. Sign up, set your shop name as your display name, and list boards from Sell. The shop offer is a fee setting on that account after you apply.",
    href: helpArticlePath("selling", "how-to-list-a-board"),
  },
  {
    question: "What does it cost after the offer?",
    answer: `It is always free to list. When a board sells after the offer ends, Reswell takes a ${MARKETPLACE_FEE_PERCENT}% marketplace fee on the item price. You keep ${SELLER_SHARE_PERCENT}%. Buyer-paid shipping is not included in that fee, and card processing is not deducted from your payout.`,
    href: helpArticlePath("selling", "marketplace-fees"),
  },
  {
    question: "Can someone pick the board up at the shop?",
    answer:
      "Yes. Each listing can offer local pickup, shipping, or both. Pickup-only is fine if you do not want to ship.",
    href: helpArticlePath("selling", "how-to-list-a-board"),
  },
  {
    question: "How is this different from the surf shop directory?",
    answer:
      "The directory at /surf-shops lists independent shops featured on Reswell city pages. This page is for any surf shop that wants a seller account, the 6-month fee offer, and to list used boards on the marketplace.",
    href: "/surf-shops",
  },
  {
    question: "How do I get paid?",
    answer:
      "Earnings go to your Reswell wallet after the sale reaches the payout state. Connect a payout account, then cash out to your bank.",
    href: helpArticlePath("selling", "how-long-to-get-paid"),
  },
]

export function forSurfShopsFaqStructuredData(): {
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
    mainEntity: FOR_SURF_SHOPS_FAQS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}
