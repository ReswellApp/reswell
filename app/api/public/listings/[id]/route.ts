import { NextRequest } from "next/server"
import {
  enforcePublicApiGuard,
  publicApiJson,
  publicApiOptionsResponse,
  publicApiRateLimitedResponse,
  publicApiRateLimitHeaders,
} from "@/lib/services/publicApiGuard"
import { getPublicListingService } from "@/lib/services/publicResearchApi"
import { publicApiListingParamSchema } from "@/lib/validations/public-api"

type RouteContext = { params: Promise<{ id: string }> }

export async function OPTIONS() {
  return publicApiOptionsResponse()
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const guard = await enforcePublicApiGuard(request)
    if (!guard.ok) return publicApiRateLimitedResponse(guard)

    const { id } = await context.params
    const parsed = publicApiListingParamSchema.safeParse({ id })
    if (!parsed.success) {
      return publicApiJson(
        { error: "Invalid listing id", details: parsed.error.flatten() },
        400,
      )
    }

    const result = await getPublicListingService(parsed.data.id)
    if (!result.ok) {
      return publicApiJson({ error: result.error }, result.status)
    }

    return publicApiJson(
      { success: true, data: result.data },
      200,
      {
        ...publicApiRateLimitHeaders(guard),
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    )
  } catch (error) {
    console.error("[public-api] listing failed", {
      route: "/api/public/listings/[id]",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return publicApiJson({ error: "Unable to load listing right now" }, 500)
  }
}
