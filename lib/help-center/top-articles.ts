import type { HelpCenterTopArticle } from "@/lib/help-center/types"

export const helpCenterTopArticlesByTab: Record<
  "buying" | "selling" | "accounts",
  HelpCenterTopArticle[]
> = {
  buying: [
    { title: "How do offers work on Reswell?", slug: "how-do-offers-work", topicId: "buying" },
    { title: "How do I buy on Reswell?", slug: "how-do-i-buy-a-board", topicId: "buying" },
    { title: "How do returns work for buyers on Reswell?", slug: "buyer-returns", topicId: "buying" },
    {
      title: "How am I protected if I do not receive an item or it is not as described?",
      slug: "purchase-protection-claim",
      topicId: "buying",
    },
    { title: "How to contact a seller", slug: "how-to-contact-a-seller", topicId: "buying" },
    { title: "How can I change the shipping address on my purchase?", slug: "change-shipping-address", topicId: "buying" },
    { title: "What should I do if my package is delayed or lost?", slug: "package-delayed-or-lost", topicId: "buying" },
    { title: "Can I use wallet balance at checkout?", slug: "wallet-balance-at-checkout", topicId: "buying" },
    { title: "How long do I have to pay for my Reswell purchase?", slug: "how-long-to-pay", topicId: "buying" },
    { title: "Why was I charged tax on my order?", slug: "why-charged-tax", topicId: "buying" },
  ],
  selling: [
    { title: "How to verify your seller information", slug: "verify-seller-information", topicId: "selling" },
    { title: "How to connect a bank account for payouts", slug: "connect-payout-account", topicId: "selling" },
    { title: "I made a sale. What should I do next?", slug: "i-sold-an-item-whats-next", topicId: "selling" },
    { title: "How long does it take to get paid?", slug: "how-long-to-get-paid", topicId: "selling" },
    { title: "How do I list something for sale?", slug: "how-to-list-a-board", topicId: "selling" },
    { title: "What are Reswell's selling fees?", slug: "marketplace-fees", topicId: "selling" },
    { title: "How do returns work for sellers on Reswell?", slug: "seller-returns", topicId: "selling" },
    { title: "How do I respond to messages and offers?", slug: "respond-to-offers", topicId: "selling" },
  ],
  accounts: [
    { title: "How do I change my profile, password, or notifications?", slug: "update-profile-settings", topicId: "accounts" },
    { title: "What is my wallet balance?", slug: "wallet-and-earnings-overview", topicId: "accounts" },
    { title: "How do cash outs work?", slug: "how-cash-outs-work", topicId: "accounts" },
    { title: "Where do I find my messages?", slug: "where-are-messages", topicId: "accounts" },
    { title: "Help with account access or deletion", slug: "account-access-deletion", topicId: "accounts" },
    { title: "What should I do if I think I am being scammed?", slug: "avoid-scams", topicId: "accounts" },
  ],
}
