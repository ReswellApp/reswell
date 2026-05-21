import Link from "next/link"
import type { ReactNode } from "react"
import type { HelpArticle } from "@/lib/help-center/types"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "@/lib/seller-fees"

const link = (href: string, children: ReactNode) => (
  <Link href={href} className="text-[#2563eb] underline underline-offset-2">
    {children}
  </Link>
)

export const helpArticles: HelpArticle[] = [
  // —— Buying · Shopping on Reswell ——
  {
    slug: "how-do-i-buy-a-board",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Browsing and checkout",
    title: "How do I buy a board on Reswell?",
    keywords: ["buy", "checkout", "purchase", "board"],
    quickAnswer: (
      <>
        Open any active listing and use <strong>Buy now</strong> to check out in Reswell. You can also{" "}
        <strong>Message seller</strong> first. Payment always stays inside Reswell checkout.
      </>
    ),
    sections: [
      {
        body: (
          <>
            <p className="mb-4 leading-relaxed">
              Browse boards from the {link("/boards", "Surfboards")} page, open a listing you like,
              and tap <strong>Buy now</strong> to check out. If you want to ask the seller something
              first, use <strong>Message seller</strong> on the listing page.
            </p>
            <p className="leading-relaxed">
              We do not process payments outside the app. Purchases paid off-platform are not covered
              by {link("/protection-policy", "Purchase Protection")}.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "how-do-offers-work",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Offers",
    title: "How do offers work on Reswell?",
    keywords: ["offer", "counter", "negotiate"],
    quickAnswer: (
      <>
        When a seller enables offers, tap <strong>Make an offer</strong> on the listing. The seller
        can accept, counter, or decline in Messages. After acceptance, you receive a checkout link at
        the agreed price.
      </>
    ),
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Offers live in {link("/messages", "Messages")} and in your dashboard under{" "}
            {link("/dashboard/offers", "Offers")}. Once an offer is accepted, complete payment
            through the checkout link before it expires.
          </p>
        ),
      },
    ],
  },
  {
    slug: "local-pickup-or-shipping",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Browsing and checkout",
    title: "Local pickup or shipping — how do I know which a listing offers?",
    keywords: ["pickup", "shipping", "delivery"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Every listing shows whether the seller offers local pickup, shipping, or both. For
            shipped purchases, the seller adds tracking once the board ships. For pickup, coordinate
            time and place in Messages. Read our {link("/safety", "Safety tips")} before meeting in
            person.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-do-favorites-work",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Search and favorites",
    title: "How do favorites work on Reswell?",
    keywords: ["favorite", "save", "wishlist"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Tap the heart on a listing to save it to {link("/favorites", "Favorites")}. You can
            return later to compare boards or buy when you are ready.
          </p>
        ),
      },
    ],
  },
  {
    slug: "international-buying-guide",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Buying internationally",
    title: "International buying guide",
    keywords: ["international", "cross-border", "import"],
    sections: [
      {
        body: (
          <>
            <p className="mb-4 leading-relaxed">
              Many sellers ship within the United States. Shipping costs and carriers are set per
              listing. See our {link("/shipping", "Shipping guide")} for how tracking and delivery work.
            </p>
            <p className="leading-relaxed">
              Import duties or taxes on cross-border shipments, if any, are generally the buyer&apos;s
              responsibility unless stated otherwise on the listing.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "will-i-pay-import-fees",
    topicId: "buying",
    sectionSlug: "shopping-on-reswell",
    sectionTitle: "Shopping on Reswell",
    groupTitle: "Buying internationally",
    title: "Will I pay import fees?",
    keywords: ["import", "duties", "customs", "tax"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Cross-border orders may be subject to customs duties or taxes collected by the carrier or
            local authorities. These are separate from the listing price and Reswell checkout total.
            Contact {link("/contact", "support")} if you need help understanding charges on a specific
            order.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-do-i-pay",
    topicId: "buying",
    sectionSlug: "checkout",
    sectionTitle: "Checkout",
    groupTitle: "Paying at checkout",
    title: "How do I pay for a purchase?",
    keywords: ["pay", "card", "checkout", "stripe"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Pay by card in Reswell checkout. Stripe processes card details securely. You can apply
            wallet balance from past sales toward your purchase when available.
          </p>
        ),
      },
    ],
  },
  {
    slug: "wallet-balance-at-checkout",
    topicId: "buying",
    sectionSlug: "checkout",
    sectionTitle: "Checkout",
    groupTitle: "Paying at checkout",
    title: "Can I use wallet balance at checkout?",
    keywords: ["wallet", "balance"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Earnings from completed sales appear in your wallet. At checkout you can apply available
            balance toward another listing. Manage payouts from{" "}
            {link("/dashboard/earnings", "Earnings")}.
          </p>
        ),
      },
    ],
  },
  // —— Buying · Managing purchases ——
  {
    slug: "buyer-returns",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Returns and refunds",
    title: "How do returns work for buyers on Reswell?",
    keywords: ["return", "refund"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Eligible issues are handled through {link("/return-policy", "our return policy")} and{" "}
            {link("/protection-policy", "Purchase Protection")}. Message the seller first; if you
            still need help, open the purchase from{" "}
            {link("/dashboard/purchases", "Purchases")} and use <strong>Refund help</strong>.
          </p>
        ),
      },
    ],
  },
  {
    slug: "purchase-protection-claim",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Returns and refunds",
    title: "How am I protected if I do not receive an item or it is not as described?",
    keywords: ["protection", "claim", "dispute"],
    quickAnswer: (
      <>
        {link("/protection-policy", "Purchase Protection")} covers eligible checkout purchases when
        an item never arrives, arrives damaged, or is materially different from the listing.
      </>
    ),
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            File a claim from your purchase page. We typically review within three business days.
            Exclusions and full terms are on the Purchase Protection page.
          </p>
        ),
      },
    ],
  },
  {
    slug: "package-delayed-or-lost",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "My package is delayed or lost — what should I do next?",
    keywords: ["delayed", "lost", "tracking"],
    sections: [
      {
        body: (
          <>
            <p className="mb-4 leading-relaxed">
              Check tracking on your {link("/dashboard/purchases", "purchase")} first. Message the
              seller with the tracking number and carrier updates.
            </p>
            <p className="leading-relaxed">
              If tracking stalls or the package is lost, you may qualify for Purchase Protection.
              See {link("/shipping", "Shipping")} and {link("/protection-policy", "Protection")}.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: "change-shipping-address",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "How can I change the shipping address on my purchase?",
    keywords: ["address", "shipping"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Message the seller immediately from the purchase thread. If the label has not been
            purchased yet, they may be able to update the address. Otherwise contact{" "}
            {link("/contact", "Reswell support")} with your order details.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-to-contact-a-seller",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Contacting your seller",
    title: "How to contact a seller",
    keywords: ["message", "seller", "contact"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Use <strong>Message seller</strong> on the listing or open the thread from{" "}
            {link("/messages", "Messages")}. Keep communication on Reswell so we can help if a
            dispute arises.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-long-to-pay",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "How long do I have to pay for my Reswell purchase?",
    keywords: ["pay", "deadline", "checkout"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Complete checkout promptly after <strong>Buy now</strong> or accepting an offer. Offer
            checkout links can expire — pay before the deadline shown in Messages or email.
          </p>
        ),
      },
    ],
  },
  {
    slug: "why-charged-tax",
    topicId: "buying",
    sectionSlug: "managing-purchases",
    sectionTitle: "Managing purchases",
    groupTitle: "Order issues",
    title: "Why was I charged tax on my order?",
    keywords: ["tax", "sales tax"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Sales tax may apply based on your location and applicable law. Tax appears at checkout
            before you pay. Questions about a specific charge? {link("/contact", "Contact us")}.
          </p>
        ),
      },
    ],
  },
  // —— Selling ——
  {
    slug: "how-to-list-a-board",
    topicId: "selling",
    sectionSlug: "listings",
    sectionTitle: "Listings",
    groupTitle: "Creating listings",
    title: "How do I list a board for sale?",
    keywords: ["list", "sell", "post"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Sign in and tap {link("/sell", "Sell")}. Add photos, price, condition, dimensions, fin
            setup, and whether you offer pickup, shipping, or both. Listing is free.
          </p>
        ),
      },
    ],
  },
  {
    slug: "listing-photos-and-pricing",
    topicId: "selling",
    sectionSlug: "listings",
    sectionTitle: "Listings",
    groupTitle: "Creating listings",
    title: "Tips for photos and pricing your board",
    keywords: ["photos", "price", "listing"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Use clear photos in good light, including dings and wear. Price against similar boards on{" "}
            {link("/sold", "Recently sold")} and note shipping cost if you ship.
          </p>
        ),
      },
    ],
  },
  {
    slug: "edit-or-remove-listing",
    topicId: "selling",
    sectionSlug: "listings",
    sectionTitle: "Listings",
    groupTitle: "Managing listings",
    title: "How do I edit or remove a listing?",
    keywords: ["edit", "delete", "archive"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Open the listing from {link("/dashboard/listings", "My listings")} to edit details or
            archive it when the board sells elsewhere.
          </p>
        ),
      },
    ],
  },
  {
    slug: "verify-seller-information",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Setting up your payout destination",
    title: "How to verify your seller information",
    keywords: ["verify", "payout", "identity"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Complete payout setup from {link("/dashboard/earnings", "Earnings")} or{" "}
            {link("/dashboard/payouts", "Payouts")}. Our payment partners may request identity or
            bank details before your first cash out.
          </p>
        ),
      },
    ],
  },
  {
    slug: "connect-payout-account",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Setting up your payout destination",
    title: "How to connect a bank account for payouts",
    keywords: ["bank", "payout", "connect"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Add your payout destination in Earnings. Keep details accurate so transfers are not
            delayed. Availability depends on your region and payout provider.
          </p>
        ),
      },
    ],
  },
  {
    slug: "where-payouts-available",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Setting up your payout destination",
    title: "Where are Reswell payouts available?",
    keywords: ["payout", "region", "country"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Payout options depend on your country and connected payout provider. If setup is
            unavailable in your region, {link("/contact", "contact support")} for the latest
            options.
          </p>
        ),
      },
    ],
  },
  {
    slug: "i-sold-an-item-whats-next",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Receiving your earnings",
    title: "I sold an item — what's next?",
    keywords: ["sold", "ship", "next steps"],
    quickAnswer: (
      <>
        Open the sale from {link("/dashboard/sales", "Sales")}. Ship with tracking or confirm local
        pickup in Messages. Earnings release to your wallet per Purchase Protection timelines.
      </>
    ),
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Pack carefully, add tracking for shipped boards, and respond to buyer messages. You can
            buy a label from the sale page when ShipEngine is enabled. See{" "}
            {link("/shipping", "Shipping guide")}.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-long-to-get-paid",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Receiving your earnings",
    title: "How long does it take to get paid?",
    keywords: ["paid", "payout", "timing"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Funds move to your wallet after the sale reaches the release state in{" "}
            {link("/protection-policy", "Purchase Protection")}. Cash out from Earnings when
            available; timing depends on your payout method.
          </p>
        ),
      },
    ],
  },
  {
    slug: "marketplace-fees",
    topicId: "selling",
    sectionSlug: "getting-paid",
    sectionTitle: "Getting paid",
    groupTitle: "Receiving your earnings",
    title: "What are Reswell's selling fees?",
    keywords: ["fees", "commission"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            On completed sales, Reswell takes a {MARKETPLACE_FEE_PERCENT}% marketplace fee; sellers
            keep {SELLER_SHARE_PERCENT}%. Card processing is absorbed by Reswell — not deducted on
            top. Details are in {link("/terms", "Terms of Service")}.
          </p>
        ),
      },
    ],
  },
  {
    slug: "respond-to-offers",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Offers and messages",
    title: "How do I respond to messages and offers?",
    keywords: ["offers", "messages", "counter"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Buyer messages appear in {link("/messages", "Messages")}. Manage offers from the thread
            or {link("/dashboard/offers", "Offers")} — accept, counter, or decline promptly.
          </p>
        ),
      },
    ],
  },
  {
    slug: "seller-returns",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Returns and refunds",
    title: "How do returns work for sellers on Reswell?",
    keywords: ["return", "refund", "seller"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Buyers may open claims for eligible issues. Cooperate in Messages and follow guidance
            from Reswell on the sale. See {link("/return-policy", "Return policy")} and Protection.
          </p>
        ),
      },
    ],
  },
  {
    slug: "cancel-order-seller",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Returns and refunds",
    title: "How do I cancel an order?",
    keywords: ["cancel", "order"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Contact the buyer in Messages and {link("/contact", "support")} if you cannot fulfill a
            sale. Do not ship if the order should be canceled — support will guide next steps.
          </p>
        ),
      },
    ],
  },
  {
    slug: "leave-feedback-buyer",
    topicId: "selling",
    sectionSlug: "managing-orders",
    sectionTitle: "Managing orders",
    groupTitle: "Contacting your buyer",
    title: "How do I leave feedback for a buyer?",
    keywords: ["feedback", "review", "buyer"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            After a completed sale, follow prompts on the order or sale page to leave feedback when
            available. Honest feedback helps the community.
          </p>
        ),
      },
    ],
  },
  // —— Accounts ——
  {
    slug: "update-profile-settings",
    topicId: "accounts",
    sectionSlug: "profile-and-settings",
    sectionTitle: "Profile and settings",
    groupTitle: "Your account",
    title: "How do I change my profile, password, or notifications?",
    keywords: ["profile", "password", "settings"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Update profile, display name, shop details, and notifications from{" "}
            {link("/dashboard/profile", "Profile")}. Use the reset link on sign-in if you forgot
            your password.
          </p>
        ),
      },
    ],
  },
  {
    slug: "account-access-deletion",
    topicId: "accounts",
    sectionSlug: "profile-and-settings",
    sectionTitle: "Profile and settings",
    groupTitle: "Your account",
    title: "Help with account access or deletion",
    keywords: ["delete", "access", "login"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            For login issues or account deletion requests, {link("/contact", "contact us")} from the
            email on your account. We verify ownership before making changes.
          </p>
        ),
      },
    ],
  },
  {
    slug: "wallet-and-earnings-overview",
    topicId: "accounts",
    sectionSlug: "wallet-and-earnings",
    sectionTitle: "Wallet and earnings",
    groupTitle: "Wallet",
    title: "What is my wallet balance?",
    keywords: ["wallet", "balance", "earnings"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Your wallet holds earnings from completed sales. Spend it at checkout or cash out from{" "}
            {link("/dashboard/earnings", "Earnings")}.
          </p>
        ),
      },
    ],
  },
  {
    slug: "how-cash-outs-work",
    topicId: "accounts",
    sectionSlug: "wallet-and-earnings",
    sectionTitle: "Wallet and earnings",
    groupTitle: "Cash outs",
    title: "How do cash outs work?",
    keywords: ["cash out", "withdraw", "payout"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Request a cash out from Earnings once funds are available. Timing depends on payout
            method and any verification checks. Keep payout details up to date.
          </p>
        ),
      },
    ],
  },
  {
    slug: "where-are-messages",
    topicId: "accounts",
    sectionSlug: "messages-and-security",
    sectionTitle: "Messages and security",
    groupTitle: "Messages",
    title: "Where do I find my messages?",
    keywords: ["messages", "inbox"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Open {link("/messages", "Messages")} from the header. Threads tie to listings and
            purchases so pickup, shipping, and order questions stay in one place.
          </p>
        ),
      },
    ],
  },
  {
    slug: "avoid-scams",
    topicId: "accounts",
    sectionSlug: "messages-and-security",
    sectionTitle: "Messages and security",
    groupTitle: "Staying safe",
    title: "I think I'm dealing with a scam — what should I do?",
    keywords: ["scam", "fraud", "safety"],
    sections: [
      {
        body: (
          <p className="leading-relaxed">
            Keep conversations in Reswell Messages. Never pay outside the app. Report the listing or
            user and {link("/contact", "contact us")}. Read {link("/safety", "Safety tips")} for red
            flags.
          </p>
        ),
      },
    ],
  },
]
