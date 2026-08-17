import { NextRequest } from "next/server"
import {
  enforcePublicApiGuard,
  publicApiJson,
  publicApiOptionsResponse,
  publicApiRateLimitedResponse,
  publicApiRateLimitHeaders,
} from "@/lib/services/publicApiGuard"
import { getPublicPricingService } from "@/lib/services/publicResearchApi"
import { publicApiPricingQuerySchema } from "@/lib/validations/public-api"

export async function OPTIONS() {
  return publicApiOptionsResponse()
}

export async function GET(request: NextRequest) {
  try {
    const guard = await enforcePublicApiGuard(request)
    if (!guard.ok) return publicApiRateLimitedResponse(guard)

    const parsed = publicApiPricingQuerySchema.safeParse({
      brand: request.nextUrl.searchParams.get("brand") ?? "",
      model: request.nextUrl.searchParams.get("model") ?? undefined,
    })
    if (!parsed.success) {
      return publicApiJson(
        { error: "Invalid query", details: parsed.error.flatten() },
        400,
      )
    }

    const result = await getPublicPricingService(parsed.data)
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
    console.error("[public-api] pricing failed", {
      route: "/api/public/pricing",
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return publicApiJson({ error: "Unable to load pricing right now" }, 500)
  }
}
