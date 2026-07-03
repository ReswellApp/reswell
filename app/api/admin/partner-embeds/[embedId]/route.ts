import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { adminUpdatePartnerEmbedBodySchema } from "@/lib/validations/partner-listing-embeds"
import {
  deletePartnerEmbedService,
  getPartnerEmbedDetailForAdminService,
  updatePartnerEmbedService,
  buildPartnerEmbedSnippet,
} from "@/lib/services/partnerListingEmbeds"
import { publicSiteOrigin } from "@/lib/public-site-origin"

type RouteContext = { params: Promise<{ embedId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params
  const result = await getPartnerEmbedDetailForAdminService(gate.ctx.supabase, embedId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  const siteOrigin = publicSiteOrigin()
  const embedSnippet = buildPartnerEmbedSnippet(result.embed.slug, siteOrigin)

  return NextResponse.json(
    {
      data: {
        embed: result.embed,
        rows: result.rows,
        embed_snippet: embedSnippet,
        embed_url: `${siteOrigin}/embed/listings/${result.embed.slug}`,
        embed_path: `/embed/listings/${result.embed.slug}`,
        json_feed_url: `${siteOrigin}/api/embed/listings/${result.embed.slug}`,
      },
    },
    { status: 200 },
  )
}

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = adminUpdatePartnerEmbedBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join(", ") || "Invalid input"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await updatePartnerEmbedService(embedId, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { updated: true, slug: result.slug } }, { status: 200 })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const { embedId } = await context.params
  const result = await deletePartnerEmbedService(embedId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json({ data: { deleted: true, slug: result.slug } }, { status: 200 })
}
