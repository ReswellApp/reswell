import { retrievalDoc } from "./build.ts"

export const accountsRetrievalDocs = [
  retrievalDoc({
    topicId: "accounts",
    slug: "update-profile-settings",
    title: "How do I change my profile, password, or notifications?",
    description:
      "Update your shop profile, photo, bio, saved addresses, password, and message SMS notifications.",
    audience: "both",
    intentTags: ["account", "notifications"],
    keywords: ["profile", "password", "settings", "shop", "photo", "bio"],
    relatedIds: [
      "accounts/notifications",
      "accounts/account-access-deletion",
      "accounts/where-are-messages",
    ],
    quickAnswer:
      "Open Profile from the dashboard. The shop tab edits photo, display name, location, and bio. Sign-in handles password. Addresses stores checkout addresses. Notifications controls SMS for Messages. Your email is shown but cannot be changed on that page.",
    sections: [
      {
        heading: "Shop profile",
        text: "Go to /dashboard/profile. Update Profile Photo, Display Name, Location, City, and Bio. Tap Save Changes. Email cannot be changed from this page — contact support if you need that.",
      },
      {
        heading: "Password and sign in",
        text: "On the Sign-in tab: Email reset link, or Change password (current + new, at least 6 characters). Sign Out ends the session. On the public sign-in page, use Forgot password?",
      },
      {
        heading: "Addresses and notifications",
        text: "Addresses tab stores shipping addresses for checkout. Notifications tab lets you opt into SMS for Messages (phone required). Order, offer, and sale updates still arrive by email and in the dashboard.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "notifications",
    title: "How do notifications work?",
    description:
      "Email, in-app, and optional SMS for messages — and where to change those settings.",
    audience: "both",
    intentTags: ["notifications", "account", "messages"],
    keywords: ["notifications", "sms", "email", "alerts", "text"],
    relatedIds: [
      "accounts/update-profile-settings",
      "accounts/where-are-messages",
      "buying/how-to-follow-a-shop",
    ],
    quickAnswer:
      "Reswell emails you about orders, offers, and sales. Messages can also send optional SMS if you opt in under Profile → Notifications. Followed shops and Board Finder alerts use email when those features are enabled.",
    sections: [
      {
        heading: "What we email",
        text: "Expect email for offers, accepted prices, purchases, sales, shipping updates, review requests, and support case replies. Check spam for password resets and quote emails.",
      },
      {
        heading: "SMS for Messages",
        text: "Profile → Notifications has Message SMS. Opt in and add a phone number to get texts for new messages. You can turn this off anytime.",
      },
      {
        heading: "In-app",
        text: "The dashboard and Messages Activity tab surface favorites, follows, and offer activity. There is not a full per-event email toggle list yet — important order traffic still emails you.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "account-access-deletion",
    title: "Help with account access or deletion",
    description:
      "Locked out of your Reswell account or want it deleted? Here is how to get help and what to expect.",
    audience: "both",
    intentTags: ["account"],
    keywords: ["delete", "access", "login", "locked out", "close account"],
    relatedIds: ["accounts/update-profile-settings", "accounts/how-to-contact-support", "accounts/avoid-scams"],
    quickAnswer:
      "Try Forgot password? and the same sign-in method you used originally (email or Google). To delete the account, contact support from the registered email. Open orders or pending payouts may need to finish first. Deleted accounts cannot be recovered.",
    sections: [
      {
        heading: "If you cannot sign in",
        text: "Use Forgot password? and check spam. If you signed up with Google, use Continue with Google. Mixing methods can look like the account does not exist. Contact support from the email you believe is on the account so we can verify ownership.",
      },
      {
        heading: "Requesting deletion",
        text: "Contact support from the registered email and say you want the account deleted. Mention active listings, open orders, and wallet balance.",
      },
      {
        heading: "Before you delete",
        text: "End or complete listings and sales. Cash out remaining wallet balance. Download records you need. Deletion is permanent.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "wallet-and-earnings-overview",
    title: "What is my wallet balance?",
    description:
      "Your Reswell wallet holds earnings from sales. Here is how pending and ready balance works.",
    audience: "both",
    intentTags: ["wallet", "payments", "payouts"],
    keywords: ["wallet", "balance", "earnings", "pending", "ready"],
    relatedIds: [
      "accounts/how-cash-outs-work",
      "buying/wallet-balance-at-checkout",
      "selling/how-long-to-get-paid",
    ],
    quickAnswer:
      "Earnings from completed sales land in your wallet. Pending is held until delivery or pickup clears. Ready to transfer can be spent at checkout or cashed out to your bank.",
    sections: [
      {
        heading: "What the wallet is",
        text: "Open /dashboard/earnings for balance, activity, and cash out. /dashboard/wallet also points at wallet tools. Ready balance can pay for other listings.",
      },
      {
        heading: "Pending vs ready",
        text: "Pending: recent sales waiting on delivery, pickup, or a hold. Ready to transfer to your bank: spendable now. Total includes pending.",
      },
      {
        heading: "Activity history",
        text: "Filter the ledger by All, Ready, Pending, Refunds, or Payouts. Wallet-paid refunds return to the wallet. Card refunds return to the card.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "how-cash-outs-work",
    title: "How do cash outs work?",
    description:
      "Transfer ready earnings from your Reswell wallet to your bank account via ACH or instant transfer.",
    audience: "seller",
    intentTags: ["payouts", "wallet", "payments"],
    keywords: ["cash out", "withdraw", "payout", "transfer", "ACH", "instant"],
    relatedIds: [
      "accounts/wallet-and-earnings-overview",
      "selling/connect-payout-account",
      "selling/how-long-to-get-paid",
    ],
    quickAnswer:
      "You need ready balance and a connected, verified bank. Tap Cash out in Earnings. Standard ACH is free and usually arrives in 2 to 3 business days. Instant transfer may be available for a fee.",
    sections: [
      {
        heading: "Before you cash out",
        text: "Ready balance only. Complete payout setup in Earnings if you have not connected a bank.",
      },
      {
        heading: "Starting a cash out",
        text: "Open Earnings, tap Cash out, choose Standard (free) or Instant (fee when available), and confirm.",
      },
      {
        heading: "Tracking",
        text: "Bank transfer history shows Processing, Sent, or Reversed. Returned transfers usually mean a closed account or mismatched name. Use Manage payout banks to fix details.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "where-are-messages",
    title: "Where do I find my messages?",
    description:
      "Open your Reswell Messages inbox for buyer and seller conversations, offers, and order threads.",
    audience: "both",
    intentTags: ["messages", "account"],
    keywords: ["messages", "inbox", "chat", "envelope"],
    relatedIds: [
      "buying/how-to-contact-a-seller",
      "accounts/how-to-contact-support",
      "selling/respond-to-offers",
    ],
    quickAnswer:
      "Tap Messages in the header or go to /messages. Threads are tied to a listing or purchase. Chats are conversations; Activity covers favorites, follows, and offer notifications.",
    sections: [
      {
        heading: "Opening Messages",
        text: "Header envelope or /messages. Offer cards, pickup coordination, and order updates stay in the same thread.",
      },
      {
        heading: "Chats vs Activity",
        text: "Chats: direct conversations. Activity: favorites, follows, and offer-related notifications. Sellers also manage offers at /dashboard/offers.",
      },
      {
        heading: "Getting help from Messages",
        text: "Need help? opens support topics such as General help, My account, Buying or selling, Payments & payouts, or Safety or another member.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "how-to-contact-support",
    title: "How do I contact Reswell support?",
    description:
      "Choose Help Center, Support hub, order Get help, or Contact — and what to include so we can reply faster.",
    audience: "both",
    intentTags: ["general", "account", "purchase"],
    keywords: ["contact", "support", "help", "email", "ticket"],
    relatedIds: [
      "buying/get-help-with-a-purchase",
      "accounts/avoid-scams",
      "accounts/account-access-deletion",
    ],
    quickAnswer:
      "Search the Help Center first. For an order, use Get help on the purchase or sale. For everything else, open Support (/support or /dashboard/support) or Contact (/contact). We read every message. Protection claims are typically reviewed within 3 business days.",
    sections: [
      {
        heading: "Pick the right door",
        text: "Help Center (/help) is self-serve articles. Support hub is for a case with the team. Order Get help is for a specific purchase or sale. Contact is for general or account-ownership issues when you cannot use the hub.",
      },
      {
        heading: "What to send",
        text: "Your account email, order or listing link, tracking, dates, and photos. Keep chats in Reswell Messages. Never send passwords or full card numbers.",
      },
      {
        heading: "Safety issues",
        text: "Report scams, harassment, or unsafe meetups immediately via Support → Safety or scam, or Report listing on the listing page. Do not pay off platform.",
      },
    ],
  }),
  retrievalDoc({
    topicId: "accounts",
    slug: "avoid-scams",
    title: "What should I do if I think I am being scammed?",
    description:
      "Red flags to watch for on Reswell and how to report suspicious listings, messages, or payment requests.",
    audience: "both",
    intentTags: ["safety"],
    keywords: ["scam", "fraud", "safety", "report", "phishing"],
    relatedIds: [
      "accounts/how-to-contact-support",
      "accounts/where-are-messages",
      "buying/how-to-contact-a-seller",
    ],
    quickAnswer:
      "Do not pay or share codes off Reswell. Report the listing or use Need help? → Safety or another member, then contact support with screenshots. Off-platform payments are not covered by Purchase Protection and we cannot recover money sent elsewhere.",
    sections: [
      {
        heading: "Common red flags",
        text: "Asks you to pay on Venmo, PayPal, wire, or a cash app. Pushes the chat to text or email only. Price too good with heavy urgency. Refuses a public pickup spot. Asks for financial info, login codes, or gift cards.",
      },
      {
        heading: "What to do",
        text: "Stop if they push off-platform payment. Report listing to Reswell on the listing page. In Messages, Need help? → Safety or another member. Contact support with screenshots and links.",
      },
      {
        heading: "Stay protected",
        text: "Pay through Reswell checkout. Keep purchase messages on the platform so we can review a dispute. Read Safety tips.",
      },
    ],
  }),
]
