export interface StoreSectionMeta {
  sectionName: string
  description: string
}

const STORE_SECTIONS: { suffix: string; meta: StoreSectionMeta }[] = [
  {
    suffix: "/dashboard",
    meta: {
      sectionName: "Overview",
      description: "Sales, shop earnings, consignor payouts, and walk-in customers.",
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
      description: "Active consigned boards on your floor — re-price, withdraw, or record off-platform sales.",
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
      sectionName: "Offers",
      description: "Buyer offers on your consigned listings — accept, counter, or decline.",
    },
  },
  {
    suffix: "/messages",
    meta: {
      sectionName: "Messages",
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

  if (normalized.includes("/inventory/") && normalized.endsWith("/label")) {
    return {
      sectionName: "Print label",
      description: "Scan at the register to ring up this board.",
    }
  }

  for (const { suffix, meta } of STORE_SECTIONS) {
    if (normalized === `${base}${suffix}` || normalized.startsWith(`${base}${suffix}/`)) {
      return meta
    }
  }

  return {
    sectionName: "Store",
    description: "Manage your consignment shop on Reswell.",
  }
}
