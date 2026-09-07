import { NextResponse } from "next/server"
import { getPublicResearchOpenApiSpec } from "@/lib/openapi/public-research-spec"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { publicApiCorsHeaders } from "@/lib/services/publicApiGuard"

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: publicApiCorsHeaders(),
  })
}

export async function GET() {
  const spec = getPublicResearchOpenApiSpec(publicSiteOrigin())
  return NextResponse.json(spec, {
    status: 200,
    headers: {
      ...publicApiCorsHeaders(),
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}
