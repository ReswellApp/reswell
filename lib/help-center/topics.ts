import type { HelpTopicIndex } from "@/lib/help-center/types"
import { helpTopicPath } from "@/lib/help-center/paths"

export const helpTopicIndexes: HelpTopicIndex[] = [
  {
    id: "buying",
    label: "Buying",
    description: "Browse, checkout, offers, orders, and Purchase Protection.",
    allArticlesHref: helpTopicPath("buying"),
    allArticlesLabel: "All buying articles",
    categoryIcons: {
      "shopping-on-reswell": "shopping-bag",
      checkout: "credit-card",
      "managing-purchases": "package-search",
    },
    sections: [
      {
        title: "Shopping on Reswell",
        slug: "shopping-on-reswell",
        groups: [
          {
            title: "Finding gear",
            articles: [
              { slug: "how-do-i-buy-a-board", title: "How do I buy on Reswell?" },
              { slug: "what-can-i-buy", title: "What can I buy on Reswell?" },
              { slug: "how-to-search", title: "How do I search and filter listings?" },
              { slug: "how-board-finder-works", title: "How does Board Finder work?" },
            ],
          },
          {
            title: "Saving and following",
            articles: [
              { slug: "how-do-favorites-work", title: "How do favorites work on Reswell?" },
              { slug: "how-to-follow-a-shop", title: "How do I follow a seller's shop?" },
            ],
          },
          {
            title: "Offers",
            articles: [{ slug: "how-do-offers-work", title: "How do offers work on Reswell?" }],
          },
        ],
      },
      {
        title: "Checkout",
        slug: "checkout",
        groups: [
          {
            title: "Paying",
            articles: [
              { slug: "how-do-i-pay", title: "How do I pay for a purchase?" },
              { slug: "how-does-cart-work", title: "How does the cart work?" },
              { slug: "promo-codes", title: "How do promo codes work?" },
              { slug: "wallet-balance-at-checkout", title: "Can I use wallet balance at checkout?" },
              { slug: "why-charged-tax", title: "Why was I charged tax on my order?" },
            ],
          },
        ],
      },
      {
        title: "Orders and protection",
        slug: "managing-purchases",
        groups: [
          {
            title: "After you pay",
            articles: [
              { slug: "local-pickup-or-shipping", title: "How do I know if a listing offers pickup or shipping?" },
              { slug: "how-long-to-pay", title: "How long do I have to pay for my Reswell purchase?" },
              { slug: "change-shipping-address", title: "How can I change the shipping address on my purchase?" },
              { slug: "package-delayed-or-lost", title: "What should I do if my package is delayed or lost?" },
            ],
          },
          {
            title: "Returns and claims",
            articles: [
              { slug: "buyer-returns", title: "How do returns work for buyers on Reswell?" },
              {
                slug: "purchase-protection-claim",
                title: "How am I protected if I do not receive an item or it is not as described?",
              },
              { slug: "get-help-with-a-purchase", title: "How do I get help with a purchase or sale?" },
            ],
          },
          {
            title: "Sellers and reviews",
            articles: [
              { slug: "how-to-contact-a-seller", title: "How to contact a seller" },
              { slug: "leave-seller-review", title: "How do I leave a review for a seller?" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "selling",
    label: "Selling",
    description: "List gear, ship orders, use We’ll buy, and get paid.",
    allArticlesHref: helpTopicPath("selling"),
    allArticlesLabel: "All selling articles",
    categoryIcons: {
      listings: "tags",
      "we-buy": "package",
      "managing-orders": "clipboard-list",
      "getting-paid": "banknote",
    },
    sections: [
      {
        title: "Listings",
        slug: "listings",
        groups: [
          {
            title: "Creating listings",
            articles: [
              { slug: "how-to-list-a-board", title: "How do I list something for sale?" },
              { slug: "what-can-i-sell", title: "What can I sell on Reswell?" },
              { slug: "listing-photos-and-pricing", title: "Tips for photos and pricing your listing" },
            ],
          },
          {
            title: "Managing listings",
            articles: [{ slug: "edit-or-remove-listing", title: "How do I edit or remove a listing?" }],
          },
        ],
      },
      {
        title: "We’ll buy your surfboard",
        slug: "we-buy",
        groups: [
          {
            title: "Sell a board to Reswell",
            articles: [
              { slug: "we-buy-your-surfboard", title: "Will Reswell buy my surfboard?" },
              { slug: "we-buy-shipping-and-boxes", title: "What box do I need for We’ll buy your surfboard?" },
            ],
          },
        ],
      },
      {
        title: "Orders and payouts",
        slug: "managing-orders",
        groups: [
          {
            title: "After a sale",
            articles: [
              { slug: "i-sold-an-item-whats-next", title: "I made a sale. What should I do next?" },
              { slug: "how-to-ship-an-order", title: "How do I ship an order on Reswell?" },
              { slug: "respond-to-offers", title: "How do I respond to messages and offers?" },
            ],
          },
          {
            title: "Returns, cancels, and reviews",
            articles: [
              { slug: "seller-returns", title: "How do returns work for sellers on Reswell?" },
              { slug: "cancel-order-seller", title: "How do I cancel an order?" },
              { slug: "leave-feedback-buyer", title: "How do I leave feedback for a buyer?" },
            ],
          },
        ],
      },
      {
        title: "Getting paid",
        slug: "getting-paid",
        groups: [
          {
            title: "Payout setup",
            articles: [
              { slug: "verify-seller-information", title: "How to verify your seller information" },
              { slug: "connect-payout-account", title: "How to connect a bank account for payouts" },
              { slug: "where-payouts-available", title: "Where are Reswell payouts available?" },
            ],
          },
          {
            title: "Earnings",
            articles: [
              { slug: "how-long-to-get-paid", title: "How long does it take to get paid?" },
              { slug: "marketplace-fees", title: "What are Reswell's selling fees?" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "accounts",
    label: "Account",
    description: "Profile, wallet, messages, support, and staying safe.",
    allArticlesHref: helpTopicPath("accounts"),
    allArticlesLabel: "All account articles",
    categoryIcons: {
      "profile-and-settings": "user-round",
      "wallet-and-earnings": "wallet",
      "messages-and-security": "shield-check",
    },
    sections: [
      {
        title: "Profile and settings",
        slug: "profile-and-settings",
        groups: [
          {
            title: "Your account",
            articles: [
              {
                slug: "update-profile-settings",
                title: "How do I change my profile, password, or notifications?",
              },
              { slug: "notifications", title: "How do notifications work?" },
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
            articles: [{ slug: "wallet-and-earnings-overview", title: "What is my wallet balance?" }],
          },
          {
            title: "Cash outs",
            articles: [{ slug: "how-cash-outs-work", title: "How do cash outs work?" }],
          },
        ],
      },
      {
        title: "Messages, support, and safety",
        slug: "messages-and-security",
        groups: [
          {
            title: "Messages and support",
            articles: [
              { slug: "where-are-messages", title: "Where do I find my messages?" },
              { slug: "how-to-contact-support", title: "How do I contact Reswell support?" },
            ],
          },
          {
            title: "Staying safe",
            articles: [{ slug: "avoid-scams", title: "What should I do if I think I am being scammed?" }],
          },
        ],
      },
    ],
  },
]
