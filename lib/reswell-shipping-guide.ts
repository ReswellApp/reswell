/**
 * Seller-facing Reswell shipping guide topics for /sell/boards.
 * Dimensions stay synced with tier + pack-band catalogs.
 */

import {
  getSurfboardShippingPackBand,
  SURFBOARD_SHIPPING_PACK_BAND_IDS,
  surfboardShippingPackBandSummaryLine,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import {
  getSurfboardShippingTier,
  SURFBOARD_SHIPPING_TIER_IDS,
  surfboardShippingTierBoardBandDescription,
  surfboardShippingTierCarrierDescription,
  surfboardShippingTierEasyWhy,
  surfboardShippingTierFixedParcel,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"

export type ReswellShippingGuideTopicId =
  | "overview"
  | SurfboardShippingTierId
  | SurfboardShippingPackBandId

export type ReswellShippingGuideBullet = {
  title: string
  body: string
}

export type ReswellShippingGuideTopic = {
  id: ReswellShippingGuideTopicId
  label: string
  /** Short nav label in the dialog sidebar. */
  navLabel: string
  headline: string
  summary: string
  bullets: ReswellShippingGuideBullet[]
  /** Optional dim line shown as a callout (L×W×H · weight). */
  sizeLine?: string
  /** Related topics to deep-link from this page. */
  relatedIds?: ReswellShippingGuideTopicId[]
}

const OVERVIEW: ReswellShippingGuideTopic = {
  id: "overview",
  label: "How Reswell shipping works",
  navLabel: "Overview",
  headline: "We handle the carrier rate — you pack to the size you pick",
  summary:
    "Buyers pay the live UPS or FedEx rate at checkout. You choose a shipping size (we recommend one from your board dimensions). After they order, Reswell buys the label and emails it to you.",
  bullets: [
    {
      title: "1. We recommend a size from your board",
      body: "Enter length (and width) in Dimensions. Reswell suggests the right shipping size so checkout quotes stay accurate.",
    },
    {
      title: "2. Confirm your packed board will fit",
      body: "Quotes use the maximum box for the size you pick. Your packed board must stay at or under that size — smaller is fine.",
    },
    {
      title: "3. Buyer pays shipping at checkout",
      body: "They see a live carrier rate for that box size and their address. You don’t set a flat shipping price.",
    },
    {
      title: "4. Get the label after the sale",
      body: "Reswell purchases the cheapest qualifying label, adds tracking, and emails you a PDF. Pack carefully, print the label, and drop it with the carrier.",
    },
  ],
  relatedIds: ["shortboard", "midlength", "longboard"],
}

function tierTopic(tierId: SurfboardShippingTierId): ReswellShippingGuideTopic {
  const tier = getSurfboardShippingTier(tierId)
  const packed = surfboardShippingTierFixedParcel(tierId)
  const boardBand = surfboardShippingTierBoardBandDescription(tierId)

  const extras: Record<SurfboardShippingTierId, ReswellShippingGuideBullet[]> = {
    shortboard: [
      {
        title: "Usually the cheapest option",
        body: "Shortboards ship as UPS/FedEx parcel. If your board fits, this is typically the lowest buyer shipping cost.",
      },
      {
        title: "Pick a pack size next",
        body: "After Shortboard, you’ll choose Compact or Medium. Smaller packs often avoid large-package fees.",
      },
      {
        title: "When to size up",
        body: "If your packed board needs more room — or the board is especially wide — choose Midlength or Longboard instead.",
      },
    ],
    midlength: [
      {
        title: "For longer or wider packs",
        body: "Use Midlength when the board (or packing) won’t fit the Shortboard ceiling, or when width needs more room.",
      },
      {
        title: "Ships by freight",
        body: surfboardShippingTierCarrierDescription("midlength"),
      },
      {
        title: "Expect a higher rate",
        body: "Freight is usually more than Shortboard parcel. Only pick this size when you need the extra room.",
      },
    ],
    longboard: [
      {
        title: "Biggest boards and packs",
        body: "Longboard is the largest Reswell shipping size — for logs and anything that won’t fit Midlength.",
      },
      {
        title: "Ships by freight",
        body: surfboardShippingTierCarrierDescription("longboard"),
      },
      {
        title: "Confirm before you list",
        body: "Make sure your packed board will stay within the maximum size. Oversized packs can delay or block shipping.",
      },
    ],
  }

  return {
    id: tierId,
    label: tier.label,
    navLabel: tier.label,
    headline: surfboardShippingTierEasyWhy(tierId),
    summary: `${boardBand}. Maximum packed size: ${packed.lengthIn} × ${packed.widthIn} × ${packed.heightIn} in · ${packed.weightLb} lb.`,
    sizeLine: `${packed.lengthIn} × ${packed.widthIn} × ${packed.heightIn} in · ${packed.weightLb} lb`,
    bullets: extras[tierId],
    relatedIds:
      tierId === "shortboard"
        ? ["shortboard_compact", "shortboard_medium", "overview"]
        : ["overview", "shortboard"],
  }
}

function packBandTopic(bandId: SurfboardShippingPackBandId): ReswellShippingGuideTopic {
  const band = getSurfboardShippingPackBand(bandId)
  const extras: Record<SurfboardShippingPackBandId, ReswellShippingGuideBullet[]> = {
    shortboard_compact: [
      {
        title: "Best for shorter, narrower packs",
        body: "Use Compact when your packed board will stay within 72×22×4. It’s the cheapest Shortboard option for buyers when it fits.",
      },
      {
        title: "Built to avoid large-package fees",
        body: "This size is tuned to stay under common UPS large-package triggers (around 130″ DIM), which can cut buyer shipping a lot.",
      },
      {
        title: "Don’t force it",
        body: "If padding pushes you over Compact, step up to Medium. A crushed pack isn’t worth a cheaper quote.",
      },
    ],
    shortboard_medium: [
      {
        title: "For boards above 6′",
        body: "Medium adds length over Compact (78×22×4) while staying at the 130″ UPS DIM ceiling — the largest shortboard pack Reswell quotes without large-package surcharges.",
      },
      {
        title: "Still a parcel size",
        body: "Same Shortboard family as Compact — ships UPS/FedEx parcel, not freight.",
      },
      {
        title: "When Midlength is safer",
        body: "If even Medium isn’t enough (especially wide boards), switch the shipping size to Midlength or Longboard (freight).",
      },
    ],
  }

  return {
    id: bandId,
    label: `${band.label} pack`,
    navLabel: band.label,
    headline: band.summary,
    summary: `Shortboard pack size — ${surfboardShippingPackBandSummaryLine(bandId)}.`,
    sizeLine: surfboardShippingPackBandSummaryLine(bandId),
    bullets: extras[bandId],
    relatedIds: ["shortboard", "overview"],
  }
}

export const RESWELL_SHIPPING_GUIDE_TOPICS: ReswellShippingGuideTopic[] = [
  OVERVIEW,
  ...SURFBOARD_SHIPPING_TIER_IDS.map(tierTopic),
  ...SURFBOARD_SHIPPING_PACK_BAND_IDS.map(packBandTopic),
]

export function getReswellShippingGuideTopic(
  id: ReswellShippingGuideTopicId,
): ReswellShippingGuideTopic {
  const found = RESWELL_SHIPPING_GUIDE_TOPICS.find((t) => t.id === id)
  if (!found) return OVERVIEW
  return found
}

export function isReswellShippingGuideTopicId(
  value: string,
): value is ReswellShippingGuideTopicId {
  return RESWELL_SHIPPING_GUIDE_TOPICS.some((t) => t.id === value)
}

/** Nav groups shown in the guide dialog. */
export const RESWELL_SHIPPING_GUIDE_NAV: {
  heading: string
  topicIds: ReswellShippingGuideTopicId[]
}[] = [
  { heading: "Start here", topicIds: ["overview"] },
  { heading: "Shipping sizes", topicIds: [...SURFBOARD_SHIPPING_TIER_IDS] },
  { heading: "Shortboard packs", topicIds: [...SURFBOARD_SHIPPING_PACK_BAND_IDS] },
]
