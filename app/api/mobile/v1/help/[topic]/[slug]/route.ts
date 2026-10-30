import { getMobileHelpArticle } from "@/lib/services/mobileHelp"
import { mobileDataResponse, mobileFailure } from "@/lib/utils/mobile-api-response"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ topic: string; slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { topic, slug } = await context.params
    const result = getMobileHelpArticle(topic?.trim() ?? "", slug?.trim() ?? "")
    return mobileDataResponse(result, "public, max-age=60, s-maxage=120, stale-while-revalidate=300")
  } catch (error) {
    return mobileFailure("/api/mobile/v1/help/[topic]/[slug]", error, "Unable to load this help article right now")
  }
}
