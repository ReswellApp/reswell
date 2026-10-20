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
 * Boards 5′10 and under: 76×22×5 (and smaller) or 76×23×4. Both sit on the
 * 130″ length + girth line. Boards 5′11 and over need a larger box. UPS and
 * other carriers then add a large-package fee, normally about $100 more.
 */
export const HOW_TO_SELL_BEST_RATE_BOX = {
  lengthIn: 76,
  widthIn: 22,
  heightIn: 5,
} as const

/** Flatter best-rate carton for boards 5′10 and under. Width 23 stays cheap at 4″ tall. */
export const HOW_TO_SELL_BEST_RATE_FLAT_BOX = {
  lengthIn: 76,
  widthIn: 23,
  heightIn: 4,
} as const

export const HOW_TO_SELL_BEST_RATE_MAX_LENGTH_IN = HOW_TO_SELL_BEST_RATE_BOX.lengthIn

/** Longest bare board that still uses a best-rate carton. */
export const HOW_TO_SELL_BEST_RATE_MAX_BOARD_LENGTH = "5′10"

/**
 * One inch past 76×22×5 on each side. Width 23 is still a best-rate carton
 * when height stays at 4″ (76×23×4); length + girth is what trips the fee.
 */
export const HOW_TO_SELL_LARGE_PARCEL_CLIFF = {
  lengthIn: 77,
  widthIn: 23,
  heightIn: 6,
} as const

/** Shortest bare board that should ship in a larger carton. */
export const HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH = "5′11"

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

export function howToSellBoxSizeLabel(box: {
  lengthIn: number
  widthIn: number
  heightIn: number
}): string {
  return `${box.lengthIn}×${box.widthIn}×${box.heightIn}`
}

/** One-line note beside the surfboard package fields. */
export function howToSellBestBoxSizesFormNote(): string {
  const square = howToSellBoxSizeLabel(HOW_TO_SELL_BEST_RATE_BOX)
  const flat = howToSellBoxSizeLabel(HOW_TO_SELL_BEST_RATE_FLAT_BOX)
  const jump = HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD.jump
  return `Boards ${HOW_TO_SELL_BEST_RATE_MAX_BOARD_LENGTH} and under: ${square} (and smaller) or ${flat}. Boards ${HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH} and over need a larger box, usually about $${jump} more.`
}

/** Full seller guidance for the how-to-sell box section and measurement tips. */
export function howToSellBestBoxSizesLead(): string {
  const square = howToSellBoxSizeLabel(HOW_TO_SELL_BEST_RATE_BOX)
  const flat = howToSellBoxSizeLabel(HOW_TO_SELL_BEST_RATE_FLAT_BOX)
  const jump = HOW_TO_SELL_LARGE_PARCEL_TYPICAL_USD.jump
  return `Boards ${HOW_TO_SELL_BEST_RATE_MAX_BOARD_LENGTH} and under ship best in ${square} (and smaller) or ${flat}. Boards ${HOW_TO_SELL_LARGE_PARCEL_BOARD_LENGTH} and over need a larger box. UPS and other carriers then charge a large-package fee, normally about $${jump} more than a board under ${HOW_TO_SELL_BEST_RATE_MAX_BOARD_LENGTH}.`
}

export const HOW_TO_SELL_BOX_CALCULATOR_PRESETS: HowToSellBoxCalculatorPreset[] = [
  {
    id: "best-rate",
    label: `${howToSellBoxSizeLabel(HOW_TO_SELL_BEST_RATE_BOX)} · best rates`,
    lengthIn: HOW_TO_SELL_BEST_RATE_BOX.lengthIn,
    widthIn: HOW_TO_SELL_BEST_RATE_BOX.widthIn,
    heightIn: HOW_TO_SELL_BEST_RATE_BOX.heightIn,
    weightLb: compact.weightLb,
  },
  {
    id: "best-rate-flat",
    label: `${howToSellBoxSizeLabel(HOW_TO_SELL_BEST_RATE_FLAT_BOX)} · best rates`,
    lengthIn: HOW_TO_SELL_BEST_RATE_FLAT_BOX.lengthIn,
    widthIn: HOW_TO_SELL_BEST_RATE_FLAT_BOX.widthIn,
    heightIn: HOW_TO_SELL_BEST_RATE_FLAT_BOX.heightIn,
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
