import type {
  Giveaway,
  GiveawayPrizeBrand,
  GiveawayPrizeBrandId,
  GiveawayStatus,
} from "@/lib/types/giveaways"

export const GIVEAWAY_PRIZE_BRANDS: readonly GiveawayPrizeBrand[] = [
  {
    id: "channel-islands",
    name: "Channel Islands",
    shortName: "CI",
    tagline: "A custom CI.",
  },
  {
    id: "mayhem",
    name: "Lost",
    shortName: "Lost",
    tagline: "A custom Lost.",
  },
  {
    id: "js",
    name: "JS",
    shortName: "JS",
    tagline: "A custom JS.",
  },
  {
    id: "sharpeye",
    name: "Sharpeye",
    shortName: "Sharpeye",
    tagline: "A custom Sharpeye.",
  },
  {
    id: "hayden-shapes",
    name: "Hayden Shapes",
    shortName: "HS",
    tagline: "A custom Hayden Shapes.",
  },
  {
    id: "lovemachine",
    name: "Lovemachine",
    shortName: "Lovemachine",
    tagline: "A custom Lovemachine.",
  },
] as const

export const GIVEAWAY_PRIZE_BRAND_LIST_COPY =
  "Channel Islands, Lost, JS, Sharpeye, Hayden Shapes, or Lovemachine"

export const WIN_A_SURFBOARD_GIVEAWAY_SLUG = "win-a-custom-surfboard"

const WIN_A_SURFBOARD_GIVEAWAY: Giveaway = {
  slug: WIN_A_SURFBOARD_GIVEAWAY_SLUG,
  title: "List a surfboard to win a surfboard",
  eyebrow: "Giveaway",
  headline: "List a board. Win a custom.",
  summary:
    `Publish a surfboard on Reswell and you’re entered to win a custom from ${GIVEAWAY_PRIZE_BRAND_LIST_COPY}. You pick the brand.`,
  description:
    "We’re giving away a custom surfboard to one seller who lists a board on Reswell. Sign up, choose the brand you want to ride, publish a surfboard listing, and you’re in the raffle. One entry per person.",
  prizeLabel: `One custom surfboard from ${GIVEAWAY_PRIZE_BRAND_LIST_COPY}`,
  startsAt: "2026-08-18T00:00:00.000Z",
  endsAt: "2026-09-30T23:59:59.000Z",
  winnerDrawnAt: "2026-10-03T00:00:00.000Z",
  scheduleLabel:
    "Ends September 30th · Raffle winner is chosen on October 3rd",
  status: "active",
  requiresSurfboardListing: true,
  prizeBrands: [
    "channel-islands",
    "mayhem",
    "js",
    "sharpeye",
    "hayden-shapes",
    "lovemachine",
  ],
  howItWorks: [
    {
      title: "Sign up",
      body: "Create a free Reswell account. Takes about a minute.",
    },
    {
      title: "Pick a brand",
      body: "Choose the brand you want.",
    },
    {
      title: "List a surfboard",
      body: "Publish a board by September 30th. That’s your raffle ticket. Winner drawn October 3rd.",
    },
  ],
  rules: [
    "Open to people 18 or older who live in the United States. Only surfers in the USA can win.",
    "One entry per person. Publishing a surfboard listing during the giveaway window enters you.",
    "Choose one prize brand when you enter. You can change it any time before the giveaway ends, and again if you win and want a different maker.",
    "Listings must be real surfboards offered for sale on Reswell. Drafts do not count.",
    "No purchase necessary beyond creating a free listing. Shipping or selling the board is not required to stay entered.",
    "Entries close September 30th. The winner is selected at random from qualified entries on October 3rd and notified by email.",
    "Prize is one custom surfboard from any of the prize brands, coordinated by Reswell. The winner may switch makers if they change their mind. Exact model, dimensions, and build details are confirmed with the winner.",
    "Reswell may disqualify entries that are fake, duplicate, or violate the Terms of Service.",
    `This giveaway is run by Reswell and is not sponsored, endorsed, or administered by ${GIVEAWAY_PRIZE_BRAND_LIST_COPY}.`,
  ],
}

const GIVEAWAYS: readonly Giveaway[] = [WIN_A_SURFBOARD_GIVEAWAY]

function parsedTime(iso: string): number {
  const value = new Date(iso).getTime()
  return Number.isFinite(value) ? value : 0
}

export function resolveGiveawayStatus(giveaway: Giveaway, now = Date.now()): GiveawayStatus {
  if (giveaway.status === "ended") return "ended"
  if (now < parsedTime(giveaway.startsAt)) return "upcoming"
  if (now > parsedTime(giveaway.endsAt)) return "ended"
  return giveaway.status
}

export function isGiveawayOpen(giveaway: Giveaway, now = Date.now()): boolean {
  return resolveGiveawayStatus(giveaway, now) === "active"
}

export function getGiveawayPrizeBrand(
  id: GiveawayPrizeBrandId,
): GiveawayPrizeBrand | undefined {
  return GIVEAWAY_PRIZE_BRANDS.find((brand) => brand.id === id)
}

export function getGiveawayBySlug(slug: string): Giveaway | undefined {
  return GIVEAWAYS.find((giveaway) => giveaway.slug === slug)
}

export function listGiveaways(): readonly Giveaway[] {
  return GIVEAWAYS
}

export function listCurrentGiveaways(now = Date.now()): Giveaway[] {
  return GIVEAWAYS.filter((giveaway) => {
    const status = resolveGiveawayStatus(giveaway, now)
    return status === "active" || status === "upcoming"
  })
}

export function giveawayPrizeBrandsFor(giveaway: Giveaway): GiveawayPrizeBrand[] {
  return giveaway.prizeBrands
    .map((id) => getGiveawayPrizeBrand(id))
    .filter((brand): brand is GiveawayPrizeBrand => Boolean(brand))
}

export function formatGiveawayEndDate(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}
