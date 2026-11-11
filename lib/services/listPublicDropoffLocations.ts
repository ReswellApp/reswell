import { listActiveDropoffLocations, type DropoffLocationRow } from "@/lib/db/dropoff-locations"
import { dropoffLocationsNearListing } from "@/lib/dropoff-location-nearby"
import type { PublicDropoffLocation } from "@/lib/dropoff-location-types"
import { createClient } from "@/lib/supabase/server"

function toPublic(row: DropoffLocationRow): PublicDropoffLocation {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    state: row.state,
    hoursNote: row.hours_note,
    boxRules: row.box_rules,
  }
}

export async function listPublicDropoffLocations(
  near?: { lat: number; lng: number } | null,
): Promise<PublicDropoffLocation[]> {
  const supabase = await createClient()
  const rows = await listActiveDropoffLocations(supabase)
  const matched = near ? dropoffLocationsNearListing(rows, near.lat, near.lng) : rows
  return matched.map(toPublic)
}
