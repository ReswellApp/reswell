import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { fetchPartnerEmbedPublicService } from "@/lib/services/partnerListingEmbeds"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const supabase = await createClient()
  const siteOrigin = publicSiteOrigin()

  const result = await fetchPartnerEmbedPublicService(supabase, slug, siteOrigin)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json(
    { data: result.payload },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  })
}
