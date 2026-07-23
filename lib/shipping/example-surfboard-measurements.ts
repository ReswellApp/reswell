/**
 * Quick-fill rows for the sell-flow shipping estimator (weight + outer box inches).
 * Surfboard length tiers only (no SUP, coffin bags, etc.).
 * Not used for rating logic — display and preset application only.
 */

import {
  SURFBOARD_SHIPPING_TIERS,
  SURFBOARD_TIER_EXAMPLE_BOARD_LENGTH_IN,
  surfboardShippingTierPackedParcelFromBoardLengthIn,
  surfboardShippingTierSummaryLine,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"

export type ExampleMeasurementRow = {
  id: string
  title: string
  /** Summary line like "14 lb — 76 × 20 × 6 in" */
  summary: string
  weightLb: number
  lengthIn: number
  widthIn: number
  heightIn: number
}

export const EXAMPLE_SURFBOARD_MEASUREMENTS: ExampleMeasurementRow[] = (
  ["shortboard", "midlength", "longboard"] as SurfboardShippingTierId[]
).map((id) => {
  const tier = SURFBOARD_SHIPPING_TIERS[id]
  const exampleBareIn = SURFBOARD_TIER_EXAMPLE_BOARD_LENGTH_IN[id]
  const packed = surfboardShippingTierPackedParcelFromBoardLengthIn(exampleBareIn)
  return {
    id,
    title: tier.label,
    summary: surfboardShippingTierSummaryLine(id),
    weightLb: packed.weightLb,
    lengthIn: packed.lengthIn,
    widthIn: packed.widthIn,
    heightIn: packed.heightIn,
  }
})
