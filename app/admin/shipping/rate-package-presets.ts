/**
 * Package presets for the admin shipping rate calculator.
 * Used to research live carrier rates against Reswell surfboard tier ceilings
 * and intermediate carton sizes before locking checkout quotes.
 */

import {
  SURFBOARD_SHIPPING_TIER_IDS,
  SURFBOARD_SHIPPING_TIERS,
  SURFBOARD_TIER_EXAMPLE_BOARD_LENGTH_IN,
  surfboardShippingTierFixedParcel,
  surfboardShippingTierPackedParcelFromBoardLengthIn,
  surfboardShippingTierSummaryLine,
  type SurfboardShippingTierId,
} from '@/lib/surfboard-shipping-tiers'
import { surfboardShippingDimIn } from '@/lib/shipping/surfboard-label-limits'

export type RatePackagePresetGroup =
  | 'tier_ceiling'
  | 'example_board'
  | 'size_ladder'

export type RatePackagePreset = {
  id: string
  group: RatePackagePresetGroup
  label: string
  description: string
  weightLb: number
  lengthIn: number
  widthIn: number
  heightIn: number
  tierId?: SurfboardShippingTierId
}

function dimLine(lengthIn: number, widthIn: number, heightIn: number, weightLb: number): string {
  const dim = surfboardShippingDimIn(lengthIn, widthIn, heightIn)
  return `${weightLb} lb · ${lengthIn} × ${widthIn} × ${heightIn} in · DIM ${dim}″`
}

/** Tier max carton — what checkout quotes/labels when a seller picks this tier. */
export const TIER_CEILING_PRESETS: RatePackagePreset[] = SURFBOARD_SHIPPING_TIER_IDS.map(
  (tierId) => {
    const packed = surfboardShippingTierFixedParcel(tierId)
    const tier = SURFBOARD_SHIPPING_TIERS[tierId]
    return {
      id: `ceiling-${tierId}`,
      group: 'tier_ceiling' as const,
      label: `${tier.label} max`,
      description: `${surfboardShippingTierSummaryLine(tierId)} — billed ceiling`,
      weightLb: packed.weightLb,
      lengthIn: packed.lengthIn,
      widthIn: packed.widthIn,
      heightIn: packed.heightIn,
      tierId,
    }
  },
)

/** Packed parcel from a representative bare board length in each tier band. */
export const EXAMPLE_BOARD_PRESETS: RatePackagePreset[] = SURFBOARD_SHIPPING_TIER_IDS.map(
  (tierId) => {
    const bareIn = SURFBOARD_TIER_EXAMPLE_BOARD_LENGTH_IN[tierId]
    const packed = surfboardShippingTierPackedParcelFromBoardLengthIn(bareIn)
    const ft = Math.floor(bareIn / 12)
    const inches = bareIn % 12
    const bareLabel = inches === 0 ? `${ft}'` : `${ft}'${inches}"`
    return {
      id: `example-${tierId}`,
      group: 'example_board' as const,
      label: `${SURFBOARD_SHIPPING_TIERS[tierId].label} @ ${bareLabel}`,
      description: dimLine(packed.lengthIn, packed.widthIn, packed.heightIn, packed.weightLb),
      weightLb: packed.weightLb,
      lengthIn: packed.lengthIn,
      widthIn: packed.widthIn,
      heightIn: packed.heightIn,
      tierId,
    }
  },
)

/**
 * Intermediate box lengths at each tier’s W×H×weight — useful for seeing how
 * rates climb with carton length before locking tier ceilings.
 */
function buildSizeLadder(): RatePackagePreset[] {
  const ladders: { tierId: SurfboardShippingTierId; lengthsIn: number[] }[] = [
    { tierId: 'shortboard', lengthsIn: [60, 66, 72, 78] },
    { tierId: 'midlength', lengthsIn: [80, 88, 96, 100] },
    { tierId: 'longboard', lengthsIn: [102, 110, 114, 120] },
  ]
  const out: RatePackagePreset[] = []
  for (const { tierId, lengthsIn } of ladders) {
    const tier = SURFBOARD_SHIPPING_TIERS[tierId]
    for (const lengthIn of lengthsIn) {
      out.push({
        id: `ladder-${tierId}-${lengthIn}`,
        group: 'size_ladder',
        label: `${tier.label} ${lengthIn}″`,
        description: dimLine(lengthIn, tier.widthIn, tier.heightIn, tier.weightLb),
        weightLb: tier.weightLb,
        lengthIn,
        widthIn: tier.widthIn,
        heightIn: tier.heightIn,
        tierId,
      })
    }
  }
  return out
}

export const SIZE_LADDER_PRESETS: RatePackagePreset[] = buildSizeLadder()

export const ALL_RATE_PACKAGE_PRESETS: RatePackagePreset[] = [
  ...TIER_CEILING_PRESETS,
  ...EXAMPLE_BOARD_PRESETS,
  ...SIZE_LADDER_PRESETS,
]

export function ratePackagePresetDimIn(preset: RatePackagePreset): number {
  return surfboardShippingDimIn(preset.lengthIn, preset.widthIn, preset.heightIn)
}

export function applyRatePackagePresetWeightOz(preset: RatePackagePreset): string {
  return String(Math.round(preset.weightLb * 16))
}
