"use server"

import type { PublicDropoffLocation } from "@/lib/dropoff-location-types"
import { listPublicDropoffLocations } from "@/lib/services/listPublicDropoffLocations"

/** @deprecated Use GET `/api/sell/dropoff-locations`. Server Actions refresh `/sell` and abort Save. */
export async function listActiveDropoffLocationsAction(): Promise<PublicDropoffLocation[]> {
  try {
    return await listPublicDropoffLocations()
  } catch (error) {
    console.error("[dropoff] listActiveDropoffLocationsAction", error)
    return []
  }
}
