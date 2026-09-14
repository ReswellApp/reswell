import type { HelpCenterTabId, HelpCenterTopArticle } from "@/lib/help-center/types"

export const helpCenterTopArticlesByTab: Record<HelpCenterTabId, HelpCenterTopArticle[]> = {
  buying: [
    { title: "How do I buy on Reswell?", slug: "how-do-i-buy-a-board", topicId: "buying" },
    { title: "How do offers work on Reswell?", slug: "how-do-offers-work", topicId: "buying" },
    { title: "How does the cart work?", slug: "how-does-cart-work", topicId: "buying" },
    { title: "How do promo codes work?", slug: "promo-codes", topicId: "buying" },
    {
      title: "How am I protected if I do not receive an item or it is not as described?",
      slug: "purchase-protection-claim",
      topicId: "buying",
    },
    { title: "How do returns work for buyers on Reswell?", slug: "buyer-returns", topicId: "buying" },
    { title: "How do I get help with a purchase or sale?", slug: "get-help-with-a-purchase", topicId: "buying" },
    { title: "How does Board Finder work?", slug: "how-board-finder-works", topicId: "buying" },
    { title: "What should I do if my package is delayed or lost?", slug: "package-delayed-or-lost", topicId: "buying" },
    { title: "How can I change the shipping address on my purchase?", slug: "change-shipping-address", topicId: "buying" },
  ],
  selling: [
    { title: "How do I list something for sale?", slug: "how-to-list-a-board", topicId: "selling" },
    { title: "Will Reswell buy my surfboard?", slug: "we-buy-your-surfboard", topicId: "selling" },
    { title: "I made a sale. What should I do next?", slug: "i-sold-an-item-whats-next", topicId: "selling" },
    { title: "How do I ship an order on Reswell?", slug: "how-to-ship-an-order", topicId: "selling" },
    { title: "What are Reswell's selling fees?", slug: "marketplace-fees", topicId: "selling" },
    { title: "How long does it take to get paid?", slug: "how-long-to-get-paid", topicId: "selling" },
    { title: "How to connect a bank account for payouts", slug: "connect-payout-account", topicId: "selling" },
    { title: "How do I respond to messages and offers?", slug: "respond-to-offers", topicId: "selling" },
  ],
  accounts: [
    { title: "How do I change my profile, password, or notifications?", slug: "update-profile-settings", topicId: "accounts" },
    { title: "How do notifications work?", slug: "notifications", topicId: "accounts" },
    { title: "What is my wallet balance?", slug: "wallet-and-earnings-overview", topicId: "accounts" },
    { title: "How do cash outs work?", slug: "how-cash-outs-work", topicId: "accounts" },
    { title: "How do I contact Reswell support?", slug: "how-to-contact-support", topicId: "accounts" },
    { title: "Where do I find my messages?", slug: "where-are-messages", topicId: "accounts" },
    { title: "What should I do if I think I am being scammed?", slug: "avoid-scams", topicId: "accounts" },
    { title: "Help with account access or deletion", slug: "account-access-deletion", topicId: "accounts" },
  ],
}
