import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { helpArticlePath } from "@/lib/help-center/paths"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

export const FOR_SURF_SHOPS_PATH = "/for-surf-shops"
export const FOR_SURF_SHOPS_PAGE_KEY = "for-surf-shops"

export const FOR_SURF_SHOPS_TITLE = "Sell used surfboards from your shop | Reswell"

export const FOR_SURF_SHOPS_DESCRIPTION = `Surf shops: create a free Reswell account and list trade-ins and used boards. Free to post. You keep ${SELLER_SHARE_PERCENT}% of the item price when a board sells.`

export const FOR_SURF_SHOPS_HERO_DESCRIPTION =
  "Create a free Reswell account and list the used boards on your rack — trade-ins, boards you took in, and demos you are done with. Buyers pay on Reswell and can pick the board up at the shop or have it shipped."

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
    title: "Free until it sells",
    body: `Listing costs nothing. Reswell takes ${MARKETPLACE_FEE_PERCENT}% of the item price only when a board sells. You keep ${SELLER_SHARE_PERCENT}%.`,
  },
  {
    key: "shipping",
    title: "Pickup or shipping",
    body: "Offer local pickup, Reswell shipping, or both. The buyer pays the shipping label at checkout. Shipping is not part of the marketplace fee.",
  },
  {
    key: "shop",
    title: "A public shop page",
    body: "Your display name, listings, and buyer reviews live on one seller page people can follow.",
  },
] as const

export const FOR_SURF_SHOPS_STEPS = [
  {
    title: "Create a Reswell account",
    body: "Sign up with email or Google. You land in Sell, ready to list the first board.",
  },
  {
    title: "Put your shop name on the profile",
    body: "Set the shop name as your display name. That name shows on every listing and on your public seller page.",
  },
  {
    title: "Photograph and price each board",
    body: "Deck, bottom, rails, and any dings. Check recently sold boards for a similar brand, size, and condition.",
  },
  {
    title: "Publish, then get paid in your wallet",
    body: "Posting is free. When a board sells, earnings go to your Reswell wallet. Connect a bank account and cash out when the sale is ready.",
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

export type ForSurfShopsFaq = {
  question: string
  answer: string
  href: string
}

export const FOR_SURF_SHOPS_FAQS: readonly ForSurfShopsFaq[] = [
  {
    question: "Do surf shops need a special account?",
    answer:
      "No. Shops use the same free Reswell account as any seller. Sign up, set your shop name as your display name, and list boards from Sell.",
    href: helpArticlePath("selling", "how-to-list-a-board"),
  },
  {
    question: "What does it cost to sell a used board?",
    answer: `It is free to list. When a board sells, Reswell takes a ${MARKETPLACE_FEE_PERCENT}% marketplace fee on the item price. You keep ${SELLER_SHARE_PERCENT}%. Buyer-paid shipping is not included in that fee, and card processing is not deducted from your payout.`,
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
      "The directory at /surf-shops lists independent shops featured on Reswell city pages. This page is for any surf shop that wants a seller account and to list used boards on the marketplace.",
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
