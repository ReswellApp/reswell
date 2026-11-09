import { mobileReviewsQuerySchema } from "@reswell/api-contract"
import { readMobileSession } from "@/lib/auth/mobile-session"
import { listMobileReviewsForUserService } from "@/lib/services/mobileAccountApi"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await readMobileSession(request)
    if (!session.ok) return mobileDataResponse(session, "private, no-store")

    const url = new URL(request.url)
    const parsedQuery = mobileReviewsQuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    })
    if (!parsedQuery.success) {
      return mobileDataResponse({ ok: false, status: 400, error: "Invalid reviews query" }, "private, no-store")
    }

    const result = await listMobileReviewsForUserService(session.user.id, parsedQuery.data)
    return mobileDataResponse(result, "private, no-store")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/me/reviews", error, "Unable to load reviews right now")
  }
}
