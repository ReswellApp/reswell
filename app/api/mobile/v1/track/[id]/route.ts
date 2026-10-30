import { NextResponse } from "next/server"
import { mobileTrackPackageParamSchema } from "@reswell/api-contract"
import { getMobileTrackPackage } from "@/lib/services/mobileTrackPackage"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const parsed = mobileTrackPackageParamSchema.safeParse({ id: id?.trim() ?? "" })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 })
    }

    const result = await getMobileTrackPackage(parsed.data.id)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/track/[id]", error, "Unable to load tracking right now")
  }
}
