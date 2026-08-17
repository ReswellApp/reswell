import { NextRequest } from "next/server"
import {
  enforcePublicApiGuard,
  publicApiJson,
  publicApiOptionsResponse,
  publicApiRateLimitedResponse,
  publicApiRateLimitHeaders,
} from "@/lib/services/publicApiGuard"
import { searchPublicResearchService } from "@/lib/services/publicResearchApi"
import { publicApiSearchQuerySchema } from "@/lib/validations/public-api"

export async function OPTIONS() {
  return publicApiOptionsResponse()
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforcePublicApiGuard(request)
    if (!guard.ok) return publicApiRateLimitedResponse(guard)

    const parsed = publicApiSearchQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? "",
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    })
    if (!parsed.success) {
      return publicApiJson(
        { error: "Invalid query", details: parsed.error.flatten() },
        400,
      )
    }

    const result = await searchPublicResearchService(parsed.data)
    if (!result.ok) {
      return publicApiJson({ error: result.error }, result.status)
    }

    return publicApiJson(
      { success: true, data: result.data },
      200,
      {
        ...publicApiRateLimitHeaders(guard),
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    )
  } catch (error) {
    console.error("[public-api] search failed", {
      route: "/api/public/search",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return publicApiJson({ error: "Unable to search right now" }, 500)
  }
}
