export const GIVEAWAY_PRIZE_BRAND_IDS = [
  "channel-islands",
  "mayhem",
  "js",
  "sharpeye",
  "hayden-shapes",
  "lovemachine",
] as const

export type GiveawayPrizeBrandId = (typeof GIVEAWAY_PRIZE_BRAND_IDS)[number]

export type GiveawayPrizeBrand = {
  id: GiveawayPrizeBrandId
  name: string
  shortName: string
  tagline: string
}

export type GiveawayStatus = "upcoming" | "active" | "ended"

export type GiveawayEntryStatus = "pending" | "qualified"

export const GIVEAWAY_EVENT_KINDS = ["cta_click", "brand_click"] as const
export type GiveawayEventKind = (typeof GIVEAWAY_EVENT_KINDS)[number]

export const GIVEAWAY_EVENT_SURFACES = [
  "homepage",
  "popup",
  "giveaway_page",
  "sell",
] as const
export type GiveawayEventSurface = (typeof GIVEAWAY_EVENT_SURFACES)[number]

export type Giveaway = {
  slug: string
  title: string
  eyebrow: string
  headline: string
  summary: string
  description: string
  prizeLabel: string
  startsAt: string
  endsAt: string
  winnerDrawnAt: string
  scheduleLabel: string
  status: GiveawayStatus
  requiresSurfboardListing: boolean
  prizeBrands: readonly GiveawayPrizeBrandId[]
  howItWorks: readonly { title: string; body: string }[]
  rules: readonly string[]
}

export type GiveawayEntry = {
  id: string
  userId: string
  giveawaySlug: string
  preferredBrand: GiveawayPrizeBrandId | null
  status: GiveawayEntryStatus
  listingId: string | null
  signedUpFromCta: boolean
  ctaClickedAt: string | null
  brandSelectedAt: string | null
  createdAt: string
  qualifiedAt: string | null
}
