import { listActiveDropoffLocations } from "@/lib/db/dropoff-locations"
import type { PublicDropoffLocation } from "@/lib/dropoff-location-types"
import { createClient } from "@/lib/supabase/server"

export async function listPublicDropoffLocations(): Promise<PublicDropoffLocation[]> {
  const supabase = await createClient()
  const rows = await listActiveDropoffLocations(supabase)
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    state: row.state,
    addressLine1: row.address_line1,
    hoursNote: row.hours_note,
    boxRules: row.box_rules,
  }))
}
