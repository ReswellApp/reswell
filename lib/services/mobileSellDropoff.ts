import { mobileSellDropoffLocationsSchema, type MobileSellDropoffLocations } from "@reswell/api-contract"
import {
  dropoffRuleToPackageForm,
  matchDropoffBoxRule,
  type BoardDimsForDropoff,
} from "@/lib/dropoff-location-box-rules"
import { listPublicDropoffLocations } from "@/lib/services/listPublicDropoffLocations"

const OUTSIDE_SIZE =
  'This board is outside the sizes we pack here right now (up to 6\'6, and 6\'0 boards need to be 22" wide or less). Pack and ship it yourself, or add width if it is 6\'0 or under.'

const NEEDS_LENGTH = "Add board length (and width if it is 6'0 or under) in Info to drop off here."

/** Drop-off cities from the same list `/sell` uses for surfboards. */
export async function listMobileSellDropoffLocations(
  dims: BoardDimsForDropoff = {},
): Promise<MobileSellDropoffLocations> {
  const locations = await listPublicDropoffLocations()
  const boardLength = dims.boardLength?.trim() ?? ""
  return mobileSellDropoffLocationsSchema.parse({
    locations: locations.flatMap((location) => {
      const city = location.city.trim()
      const state = location.state.trim()
      const name = location.name.trim()
      if (!location.id || !name || !city || !state) return []
      const match = matchDropoffBoxRule(location.boxRules, dims)
      const packed = match ? dropoffRuleToPackageForm(match.rule) : null
      return [
        {
          id: location.id,
          name,
          city,
          state,
          available: packed != null,
          detail: packed
            ? "We'll send drop-off details after it sells."
            : boardLength
              ? OUTSIDE_SIZE
              : NEEDS_LENGTH,
          package: packed
            ? {
                length: packed.reswellPackageLengthIn,
                width: packed.reswellPackageWidthIn,
                height: packed.reswellPackageHeightIn,
                weight_lb: packed.reswellPackageWeightLb,
                weight_oz: packed.reswellPackageWeightOz,
              }
            : null,
        },
      ]
    }),
  })
}
