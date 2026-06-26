export interface StoreSectionMeta {
  sectionName: string
  description: string
}

const STORE_SECTIONS: { suffix: string; meta: StoreSectionMeta }[] = [
  {
    suffix: "/account/consignments",
    meta: {
      sectionName: "My consignments",
      description: "Boards you've consigned to shops, their status, and your payouts.",
    },
  },
  {
    suffix: "/account/following",
    meta: {
      sectionName: "Following",
      description: "People and shops you follow, and your followers.",
    },
  },
  {
    suffix: "/account/sales",
    meta: {
      sectionName: "Sales",
      description: "Orders where you're the seller — ship, track, and manage pickup.",
    },
  },
  {
    suffix: "/account/purchases",
    meta: {
      sectionName: "Purchases",
      description: "Boards you've bought on Reswell — delivery, support, and receipts.",
    },
  },
  {
    suffix: "/account/offers",
    meta: {
      sectionName: "Offers",
      description: "Offers you sent and offers others sent you on your personal listings.",
    },
  },
  {
    suffix: "/account/listings",
    meta: {
      sectionName: "My listings",
      description: "Personal marketplace listings — not consignment floor inventory.",
    },
  },
  {
    suffix: "/account/earnings",
    meta: {
      sectionName: "Earnings",
      description: "Wallet balance, cash out history, and payout methods for your sales.",
    },
  },
  {
    suffix: "/account/profile",
    meta: {
      sectionName: "Profile",
      description: "Your display name, bio, addresses, and notification preferences.",
    },
  },
  {
    suffix: "/account/messages",
    meta: {
      sectionName: "Messages",
      description: "Your personal inbox with buyers and sellers on the marketplace.",
    },
  },
  {
    suffix: "/account",
    meta: {
      sectionName: "Account overview",
      description: "Your Reswell account — listings, purchases, wallet, offers, and activity.",
    },
  },
  {
    suffix: "/dashboard",
    meta: {
      sectionName: "Overview",
      description: "Sales, floor inventory, shop earnings, consignor payouts, and walk-in customers.",
    },
  },
  {
    suffix: "/pos",
    meta: {
      sectionName: "Register",
      description: "Ring up consigned boards in-store — card or cash.",
    },
  },
  {
    suffix: "/intake",
    meta: {
      sectionName: "Intake approvals",
      description: "Review boards consignors dropped off and set live asking prices.",
    },
  },
  {
    suffix: "/inventory",
    meta: {
      sectionName: "Inventory",
      description:
        "Shop-owned boards you sell directly and consigned surfboards on your floor — re-price, label, or remove.",
    },
  },
  {
    suffix: "/qr",
    meta: {
      sectionName: "Intake QR",
      description: "Print the QR consignors scan to submit a board to your shop.",
    },
  },
  {
    suffix: "/offers",
    meta: {
      sectionName: "Shop offers",
      description: "Buyer offers on your consigned listings — accept, counter, or decline.",
    },
  },
  {
    suffix: "/customers",
    meta: {
      sectionName: "Customers",
      description:
        "Walk-in customers captured at your register — private to your shop, never shared with other stores.",
    },
  },
  {
    suffix: "/messages",
    meta: {
      sectionName: "Shop messages",
      description: "Conversations with buyers about boards in your shop.",
    },
  },
  {
    suffix: "/team",
    meta: {
      sectionName: "Team",
      description: "Invite managers and clerks who can run the register and approve intakes.",
    },
  },
  {
    suffix: "/settings",
    meta: {
      sectionName: "Settings",
      description: "Commission rate, store status, and Stripe Terminal location.",
    },
  },
]

/** Page title + description for store hub mobile chrome. */
export function resolveStoreSectionMeta(pathname: string, slug: string): StoreSectionMeta {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const base = `/stores/${slug}`

  if (normalized.startsWith(`${base}/messages/`)) {
    return {
      sectionName: "Conversation",
      description: "Reply as the shop — the buyer sees your store, not individual staff.",
    }
  }

  if (normalized.startsWith(`${base}/account/messages/`)) {
    return {
      sectionName: "Conversation",
      description: "Your personal marketplace conversation.",
    }
  }

  if (normalized.includes("/account/purchases/")) {
    return {
      sectionName: "Purchase",
      description: "Order details, delivery, and buyer support.",
    }
  }

  if (normalized.includes("/account/sales/")) {
    return {
      sectionName: "Sale",
      description: "Fulfillment, tracking, and seller tools for this order.",
    }
  }

  if (normalized.includes("/inventory/") && normalized.endsWith("/label")) {
    return {
      sectionName: "Print label",
      description: "Scan at the register to ring up this board.",
    }
  }

  const sortedSections = [...STORE_SECTIONS].sort((a, b) => b.suffix.length - a.suffix.length)

  for (const { suffix, meta } of sortedSections) {
    if (normalized === `${base}${suffix}` || normalized.startsWith(`${base}${suffix}/`)) {
      return meta
    }
  }

  return {
    sectionName: "Store",
    description: "Manage your consignment shop on Reswell.",
  }
}
