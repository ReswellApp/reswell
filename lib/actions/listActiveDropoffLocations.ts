"use server"

import type { PublicDropoffLocation } from "@/lib/dropoff-location-types"
import { listPublicDropoffLocations } from "@/lib/services/listPublicDropoffLocations"

export async function listActiveDropoffLocationsAction(): Promise<PublicDropoffLocation[]> {
  try {
    return await listPublicDropoffLocations()
  } catch (error) {
    console.error("[dropoff] listActiveDropoffLocationsAction", error)
    return []
  }
}
