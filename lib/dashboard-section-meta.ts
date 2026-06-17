export interface DashboardSectionMeta {
  /** Shown in "Dashboard — {sectionName}" and as the section heading below the dropdown. */
  sectionName: string
  description: string
}

const OVERVIEW_META: DashboardSectionMeta = {
  sectionName: "Overview",
  description: "Here is what is happening with your account — updates in real time.",
}

const SECTION_META_BY_PREFIX: { prefix: string; meta: DashboardSectionMeta }[] = [
  {
    prefix: "/messages",
    meta: {
      sectionName: "Messages",
      description: "Communicate with buyers and sellers.",
    },
  },
  {
    prefix: "/dashboard/listings/archived",
    meta: {
      sectionName: "Archived Listings",
      description: "Ended listings are kept for 30 days, then permanently deleted.",
    },
  },
  {
    prefix: "/dashboard/listings",
    meta: {
      sectionName: "My Listings",
      description: "Summary of your surfboard inventory and performance.",
    },
  },
  {
    prefix: "/dashboard/profile",
    meta: {
      sectionName: "Profile",
      description: "Update your profile, addresses, and account settings.",
    },
  },
  {
    prefix: "/dashboard/earnings",
    meta: {
      sectionName: "Earnings",
      description: "Your marketplace wallet and payouts.",
    },
  },
  {
    prefix: "/dashboard/offers",
    meta: {
      sectionName: "Offers",
      description: "Review and respond to offers on your listings and purchases.",
    },
  },
  {
    prefix: "/dashboard/purchases",
    meta: {
      sectionName: "Purchases",
      description: "Used gear and peer-to-peer buys.",
    },
  },
  {
    prefix: "/dashboard/sales",
    meta: {
      sectionName: "Sales",
      description:
        "Card and wallet purchases of your listings. Shipping addresses appear here when the buyer paid with a card and chose delivery.",
    },
  },
  {
    prefix: "/dashboard/following",
    meta: {
      sectionName: "Following",
      description: "Switch tabs to see sellers you follow and who follows your shop.",
    },
  },
]

export function resolveDashboardSectionMeta(pathname: string): DashboardSectionMeta {
  const normalized = pathname.replace(/\/$/, "") || "/"

  if (normalized === "/dashboard") {
    return OVERVIEW_META
  }

  for (const { prefix, meta } of SECTION_META_BY_PREFIX) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return meta
    }
  }

  return OVERVIEW_META
}
