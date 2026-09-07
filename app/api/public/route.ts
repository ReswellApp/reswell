import { NextRequest } from "next/server"
import {
  enforcePublicApiGuard,
  publicApiJson,
  publicApiOptionsResponse,
  publicApiRateLimitedResponse,
  publicApiRateLimitHeaders,
} from "@/lib/services/publicApiGuard"
import { getPublicApiCatalog } from "@/lib/services/publicResearchApi"

export async function OPTIONS() {
  return publicApiOptionsResponse()
}

export async function GET(request: NextRequest) {
  const guard = await enforcePublicApiGuard(request)
  if (!guard.ok) return publicApiRateLimitedResponse(guard)

  return publicApiJson(
    { success: true, data: getPublicApiCatalog() },
    200,
    {
      ...publicApiRateLimitHeaders(guard),
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  )
}
