import { mobileSellDropoffLocationsSchema, type MobileSellDropoffLocations } from "@reswell/api-contract"
import { listPublicDropoffLocations } from "@/lib/services/listPublicDropoffLocations"

/** Drop-off cities from the same list `/sell` uses for surfboards. */
export async function listMobileSellDropoffLocations(): Promise<MobileSellDropoffLocations> {
  const locations = await listPublicDropoffLocations()
  return mobileSellDropoffLocationsSchema.parse({
    locations: locations.flatMap((location) => {
      const city = location.city.trim()
      const state = location.state.trim()
      const name = location.name.trim()
      if (!location.id || !name || !city || !state) return []
      return [{ id: location.id, name, city, state }]
    }),
  })
}
