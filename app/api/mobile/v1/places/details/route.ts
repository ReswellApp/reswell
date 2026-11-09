import { NextResponse } from "next/server"
import { mobilePlaceDetailsQuerySchema } from "@reswell/api-contract"
import { readMobilePlace } from "@/lib/services/mobilePlaceSuggest"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** GET `/api/mobile/v1/places/details?place_id=` — city and state for a Google suggestion. */
export async function GET(request: Request) {
  try {
    const parsed = mobilePlaceDetailsQuerySchema.safeParse({
      place_id: new URL(request.url).searchParams.get("place_id") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a place from the list" }, { status: 400 })
    }
    const data = await readMobilePlace(parsed.data.place_id)
    if (!data) {
      return NextResponse.json({ error: "Couldn't read that place" }, { status: 404 })
    }
    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "private, max-age=300" } },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/places/details", error, "Could not read that place right now")
  }
}
