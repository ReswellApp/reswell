import { NextResponse } from "next/server"
import { mobilePlaceSuggestQuerySchema } from "@reswell/api-contract"
import { suggestMobilePlaces } from "@/lib/services/mobilePlaceSuggest"
import { mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

/** GET `/api/mobile/v1/places/suggest?q=` — Google place dropdown for the sell location field. */
export async function GET(request: Request) {
  try {
    const parsed = mobilePlaceSuggestQuerySchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ data: { suggestions: [] } }, { status: 200 })
    }
    const data = await suggestMobilePlaces(parsed.data.q)
    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "private, max-age=60" } },
    )
  } catch (error) {
    return mobileFailure("/api/mobile/v1/places/suggest", error, "Could not search places right now")
  }
}
