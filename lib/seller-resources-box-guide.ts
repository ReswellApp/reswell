import {
  SURFBOARD_SHIPPING_DIM_FORMULA,
  surfboardShippingDimIn,
} from "@/lib/shipping/surfboard-label-limits"
import { UPS_LARGE_PACKAGE_DIM_IN } from "@/lib/shipping/ups-parcel-surcharge-flags"
import {
  SURFBOARD_SHIPPING_PACK_BANDS,
} from "@/lib/surfboard-shipping-pack-bands"
import {
  SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN,
  SURFBOARD_TIER_LONGBOARD_PROFILE_HEIGHT_IN,
  SURFBOARD_TIER_LONGBOARD_PROFILE_WIDTH_IN,
  SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN,
  SURFBOARD_TIER_MIDLENGTH_PROFILE_HEIGHT_IN,
  SURFBOARD_TIER_MIDLENGTH_PROFILE_WIDTH_IN,
} from "@/lib/surfboard-shipping-tiers"

export type HowToSellBoxGuideRateBand = "best" | "higher" | "freight"

export type HowToSellBoxGuideSize = {
  id: string
  name: string
  lengthIn: number
  widthIn: number
  heightIn: number
  dimIn: number
  rateBand: HowToSellBoxGuideRateBand
  badge: string
  fits: string
  note: string
}

/**
 * Seller-facing carton sizes for /seller-resources/how-to-sell.
 * Best-rate target is 76×22×5 (or smaller). Length at or under 76″ is the
 * line that keeps most shortboards in the cheap UPS parcel band.
 */
export const HOW_TO_SELL_BEST_RATE_BOX = {
  lengthIn: 76,
  widthIn: 22,
  heightIn: 5,
} as const

export const HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN = HOW_TO_SELL_BEST_RATE_BOX.lengthIn

const compact = SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact
const medium = SURFBOARD_SHIPPING_PACK_BANDS.shortboard_medium

function boxSize(
  input: Omit<HowToSellBoxGuideSize, "dimIn">,
): HowToSellBoxGuideSize {
  return {
    ...input,
    dimIn: surfboardShippingDimIn(input.lengthIn, input.widthIn, input.heightIn),
  }
}

export const HOW_TO_SELL_BOX_GUIDE_SIZES: HowToSellBoxGuideSize[] = [
  boxSize({
    id: "best-rate",
    name: "Best-rate shortboard box",
    lengthIn: HOW_TO_SELL_BEST_RATE_BOX.lengthIn,
    widthIn: HOW_TO_SELL_BEST_RATE_BOX.widthIn,
    heightIn: HOW_TO_SELL_BEST_RATE_BOX.heightIn,
    rateBand: "best",
    badge: "Best rates",
    fits: "Most shortboards that pack at or under 76″",
    note: "This is the carton to buy and enter on Sell. Stay at or below 76″ length with a 22×5 profile and buyers see the cheapest Reswell-calculated parcel rates.",
  }),
  boxSize({
    id: "compact",
    name: compact.label,
    lengthIn: compact.lengthIn,
    widthIn: compact.widthIn,
    heightIn: compact.heightIn,
    rateBand: "best",
    badge: "Even tighter",
    fits: "Shorter, narrower boards (about 5′11 and under)",
    note: "Same 22×5 profile as the best-rate box, just shorter. Use it when the packed board truly fits — it stays under the UPS large-package DIM cliff.",
  }),
  boxSize({
    id: "medium",
    name: `${medium.label} shortboard`,
    lengthIn: medium.lengthIn,
    widthIn: medium.widthIn,
    heightIn: medium.heightIn,
    rateBand: "higher",
    badge: "Higher parcel",
    fits: "Packed boards that need more than 76″ of length",
    note: "Still UPS/FedEx parcel, but this carton sits above the 130″ DIM trigger. Expect a jump in buyer shipping versus 76×22×5.",
  }),
  boxSize({
    id: "midlength",
    name: "Midlength freight",
    lengthIn: SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN,
    widthIn: SURFBOARD_TIER_MIDLENGTH_PROFILE_WIDTH_IN,
    heightIn: SURFBOARD_TIER_MIDLENGTH_PROFILE_HEIGHT_IN,
    rateBand: "freight",
    badge: "Freight",
    fits: "Mids and anything that will not fit a shortboard carton",
    note: "Ships freight, not parcel. Use only when the board (or packing) will not stay in a 76–78″ shortboard box.",
  }),
  boxSize({
    id: "longboard",
    name: "Longboard freight",
    lengthIn: SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN,
    widthIn: SURFBOARD_TIER_LONGBOARD_PROFILE_WIDTH_IN,
    heightIn: SURFBOARD_TIER_LONGBOARD_PROFILE_HEIGHT_IN,
    rateBand: "freight",
    badge: "Freight",
    fits: "Logs and the longest packs",
    note: "Largest Reswell shipping size. Confirm the packed board stays within this ceiling before you offer shipping.",
  }),
]

export const HOW_TO_SELL_BOX_DIM_FORMULA = SURFBOARD_SHIPPING_DIM_FORMULA
export const HOW_TO_SELL_BOX_LARGE_PACKAGE_DIM_IN = UPS_LARGE_PACKAGE_DIM_IN

export function howToSellBoxDimLine(size: HowToSellBoxGuideSize): string {
  return `${size.lengthIn} × ${size.widthIn} × ${size.heightIn} in · DIM ${size.dimIn}″`
}
