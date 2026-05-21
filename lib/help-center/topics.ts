import type { HelpTopicIndex } from "@/lib/help-center/types"
import { helpTopicPath } from "@/lib/help-center/paths"

export const helpTopicIndexes: HelpTopicIndex[] = [
  {
    id: "buying",
    label: "Buying",
    allArticlesHref: helpTopicPath("buying"),
    allArticlesLabel: "All buying articles",
    categoryImages: {
      "shopping-on-reswell": {
        src: "/images/home/how-it-works-sell-list.png",
        alt: "Surfboards listed for sale on Reswell",
      },
      "managing-purchases": {
        src: "/images/home/how-it-works-sell-connect.png",
        alt: "Buyer reviewing a purchase on Reswell",
      },
      checkout: {
        src: "/images/home/how-it-works-sell-paid.png",
        alt: "Completing checkout on Reswell",
      },
    },
    sections: [
      {
        title: "Shopping on Reswell",
        slug: "shopping-on-reswell",
        groups: [
          {
            title: "Browsing and checkout",
            articles: [
              { slug: "how-do-i-buy-a-board", title: "How do I buy a board on Reswell?" },
              { slug: "local-pickup-or-shipping", title: "How do I know if a listing offers pickup or shipping?" },
            ],
          },
          {
            title: "Search and favorites",
            articles: [
              { slug: "how-do-favorites-work", title: "How do favorites work on Reswell?" },
            ],
          },
          {
            title: "Offers",
            articles: [
              { slug: "how-do-offers-work", title: "How do offers work on Reswell?" },
            ],
          },
        ],
      },
      {
        title: "Checkout",
        slug: "checkout",
        groups: [
          {
            title: "Paying at checkout",
            articles: [
              { slug: "how-do-i-pay", title: "How do I pay for a purchase?" },
              { slug: "wallet-balance-at-checkout", title: "Can I use wallet balance at checkout?" },
            ],
          },
        ],
      },
      {
        title: "Managing purchases",
        slug: "managing-purchases",
        groups: [
          {
            title: "Returns and refunds",
            articles: [
              { slug: "buyer-returns", title: "How do returns work for buyers on Reswell?" },
              { slug: "purchase-protection-claim", title: "How am I protected if I do not receive an item or it is not as described?" },
            ],
          },
          {
            title: "Order issues",
            articles: [
              { slug: "package-delayed-or-lost", title: "What should I do if my package is delayed or lost?" },
              { slug: "change-shipping-address", title: "How can I change the shipping address on my purchase?" },
              { slug: "how-long-to-pay", title: "How long do I have to pay for my Reswell purchase?" },
              { slug: "why-charged-tax", title: "Why was I charged tax on my order?" },
            ],
          },
          {
            title: "Contacting your seller",
            articles: [
              { slug: "how-to-contact-a-seller", title: "How to contact a seller" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "selling",
    label: "Selling",
    allArticlesHref: helpTopicPath("selling"),
    allArticlesLabel: "All selling articles",
    categoryImages: {
      "getting-paid": {
        src: "/images/home/how-it-works-sell-paid.png",
        alt: "Seller receiving payment on Reswell",
      },
      "managing-orders": {
        src: "/images/home/how-it-works-sell-connect.png",
        alt: "Seller managing an order on Reswell",
      },
      listings: {
        src: "/images/home/how-it-works-sell-list.png",
        alt: "Seller creating a surfboard listing",
      },
    },
    sections: [
      {
        title: "Getting paid",
        slug: "getting-paid",
        groups: [
          {
            title: "Setting up your payout destination",
            articles: [
              { slug: "verify-seller-information", title: "How to verify your seller information" },
              { slug: "connect-payout-account", title: "How to connect a bank account for payouts" },
              { slug: "where-payouts-available", title: "Where are Reswell payouts available?" },
            ],
          },
          {
            title: "Receiving your earnings",
            articles: [
              { slug: "i-sold-an-item-whats-next", title: "I sold a board. What should I do next?" },
              { slug: "how-long-to-get-paid", title: "How long does it take to get paid?" },
              { slug: "marketplace-fees", title: "What are Reswell's selling fees?" },
            ],
          },
        ],
      },
      {
        title: "Managing orders",
        slug: "managing-orders",
        groups: [
          {
            title: "Returns and refunds",
            articles: [
              { slug: "seller-returns", title: "How do returns work for sellers on Reswell?" },
              { slug: "cancel-order-seller", title: "How do I cancel an order?" },
            ],
          },
          {
            title: "Offers and messages",
            articles: [
              { slug: "respond-to-offers", title: "How do I respond to messages and offers?" },
            ],
          },
          {
            title: "Contacting your buyer",
            articles: [
              { slug: "leave-feedback-buyer", title: "How do I leave feedback for a buyer?" },
            ],
          },
        ],
      },
      {
        title: "Listings",
        slug: "listings",
        groups: [
          {
            title: "Creating listings",
            articles: [
              { slug: "how-to-list-a-board", title: "How do I list a board for sale?" },
              { slug: "listing-photos-and-pricing", title: "Tips for photos and pricing your board" },
            ],
          },
          {
            title: "Managing listings",
            articles: [
              { slug: "edit-or-remove-listing", title: "How do I edit or remove a listing?" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    allArticlesHref: helpTopicPath("accounts"),
    allArticlesLabel: "All account articles",
    categoryImages: {
      "profile-and-settings": {
        src: "/images/home/how-it-works-sell-connect.png",
        alt: "Updating your Reswell profile",
      },
      "wallet-and-earnings": {
        src: "/images/home/how-it-works-sell-paid.png",
        alt: "Viewing earnings in your Reswell wallet",
      },
      "messages-and-security": {
        src: "/images/home/how-it-works-sell-list.png",
        alt: "Reswell messages inbox",
      },
    },
    sections: [
      {
        title: "Profile and settings",
        slug: "profile-and-settings",
        groups: [
          {
            title: "Your account",
            articles: [
              { slug: "update-profile-settings", title: "How do I change my profile, password, or notifications?" },
              { slug: "account-access-deletion", title: "Help with account access or deletion" },
            ],
          },
        ],
      },
      {
        title: "Wallet and earnings",
        slug: "wallet-and-earnings",
        groups: [
          {
            title: "Wallet",
            articles: [
              { slug: "wallet-and-earnings-overview", title: "What is my wallet balance?" },
            ],
          },
          {
            title: "Cash outs",
            articles: [
              { slug: "how-cash-outs-work", title: "How do cash outs work?" },
            ],
          },
        ],
      },
      {
        title: "Messages and security",
        slug: "messages-and-security",
        groups: [
          {
            title: "Messages",
            articles: [
              { slug: "where-are-messages", title: "Where do I find my messages?" },
            ],
          },
          {
            title: "Staying safe",
            articles: [
              { slug: "avoid-scams", title: "What should I do if I think I am being scammed?" },
            ],
          },
        ],
      },
    ],
  },
]
