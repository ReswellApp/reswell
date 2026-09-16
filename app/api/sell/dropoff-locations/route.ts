import { NextResponse } from "next/server"

import { listPublicDropoffLocations } from "@/lib/services/listPublicDropoffLocations"

/**
 * Public dropoff sites for `/sell`. Route handler (not a Server Action) so this
 * never POSTs to `/sell` and aborts an in-flight listing save.
 */
export async function GET() {
  try {
    const locations = await listPublicDropoffLocations()
    return NextResponse.json({ data: { locations } }, { status: 200 })
  } catch (error) {
    console.error("GET /api/sell/dropoff-locations:", error)
    return NextResponse.json({ error: "Could not load dropoff locations" }, { status: 500 })
  }
}
