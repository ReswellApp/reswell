import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchDropoffLocationById } from "@/lib/db/dropoff-locations"
import { applyDropoffPackedParcelToListingRow } from "@/lib/dropoff-location-box-rules"

/**
 * Authoritative listing carton for a dropoff city: look up box rules and
 * write the matched L×W×H/weight onto `shipping_packed_*`.
 */
export async function overlayListingRowWithDropoffParcel(
  supabase: SupabaseClient,
  input: {
    dropoffLocationId?: string | null
    boardLength?: string | null
    boardWidthInches?: string | null
  },
  row: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = input.dropoffLocationId?.trim() ?? ""
  if (!id) {
    return applyDropoffPackedParcelToListingRow(row, {
      dropoffLocationId: null,
      boxRules: null,
    })
  }

  const location = await fetchDropoffLocationById(supabase, id)
  return applyDropoffPackedParcelToListingRow(row, {
    dropoffLocationId: id,
    boardLength: input.boardLength,
    boardWidthInches: input.boardWidthInches,
    boxRules: location?.box_rules ?? null,
  })
}
