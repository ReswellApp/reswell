import { SURFBOARD_SHIPPING_PACK_BANDS } from "@/lib/surfboard-shipping-pack-bands"

export type HowToSellBoxCalculatorPreset = {
  id: string
  label: string
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}

/**
 * Seller-facing carton sizes for /seller-resources/how-to-sell.
 * Best-rate target is 76×22×5 (or smaller). Crossing 77″ / 23″ / 6″ is the
 * large-parcel cliff that typically adds about $100 to the buyer label.
 */
export const HOW_TO_SELL_BEST_RATE_BOX = {
  lengthIn: 76,
  widthIn: 22,
  heightIn: 5,
} as const

export const HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN = HOW_TO_SELL_BEST_RATE_BOX.lengthIn

/** First inch that leaves the cheap parcel band on each side. */
export const HOW_TO_SELL_LARGE_PARCEL_CLIFF = {
  lengthIn: 77,
  widthIn: 23,
  heightIn: 6,
} as const

/** Bare board length where a packed carton usually exceeds the best-rate box. */
export const HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH = "6′0"

export const HOW_TO_SELL_BEST_RATE_TYPICAL_USD = {
  inStateLow: 40,
  inStateHigh: 60,
  crossCountry: 90,
} as const

export const HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD = {
  low: 180,
  high: 190,
  jump: 100,
} as const

const compact = SURFBOARD_SHIPPING_PACK_BANDS.shortboard_compact
const medium = SURFBOARD_SHIPPING_PACK_BANDS.shortboard_medium

export const HOW_TO_SELL_BOX_CALCULATOR_PRESETS: HowToSellBoxCalculatorPreset[] = [
  {
    id: "best-rate",
    label: `${HOW_TO_SELL_BEST_RATE_BOX.lengthIn}×${HOW_TO_SELL_BEST_RATE_BOX.widthIn}×${HOW_TO_SELL_BEST_RATE_BOX.heightIn} · best rates`,
    lengthIn: HOW_TO_SELL_BEST_RATE_BOX.lengthIn,
    widthIn: HOW_TO_SELL_BEST_RATE_BOX.widthIn,
    heightIn: HOW_TO_SELL_BEST_RATE_BOX.heightIn,
    weightLb: compact.weightLb,
  },
  {
    id: "compact",
    label: `${compact.lengthIn}×${compact.widthIn}×${compact.heightIn} · tighter`,
    lengthIn: compact.lengthIn,
    widthIn: compact.widthIn,
    heightIn: compact.heightIn,
    weightLb: compact.weightLb,
  },
  {
    id: "large-parcel",
    label: `${medium.lengthIn}×${medium.widthIn}×${medium.heightIn} · large parcel`,
    lengthIn: medium.lengthIn,
    widthIn: medium.widthIn,
    heightIn: medium.heightIn,
    weightLb: medium.weightLb,
  },
]

export function howToSellBoxPresetToEstimator(preset: HowToSellBoxCalculatorPreset): {
  id: string
  label: string
  lengthIn: string
  widthIn: string
  heightIn: string
  weightLb: string
} {
  return {
    id: preset.id,
    label: preset.label,
    lengthIn: String(preset.lengthIn),
    widthIn: String(preset.widthIn),
    heightIn: String(preset.heightIn),
    weightLb: String(preset.weightLb),
  }
}
