import { NextRequest, NextResponse } from "next/server"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { getGiveawayBySlug } from "@/lib/giveaways/catalog"
import { getGiveawayEntryForUser } from "@/lib/db/giveawayEntries"
import { enterGiveaway } from "@/lib/services/giveawayEntry"
import { giveawayEntryBodySchema } from "@/lib/validations/giveaway-entry"

function slugFromParam(raw: string): string {
  return raw.trim().toLowerCase()
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug: rawSlug } = await context.params
  const slug = slugFromParam(rawSlug)
  if (!getGiveawayBySlug(slug)) {
    return NextResponse.json({ error: "Giveaway not found." }, { status: 404 })
  }

  const entry = await getGiveawayEntryForUser(supabase, user.id, slug)
  return NextResponse.json({ data: { entry } }, { status: 200 })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug: rawSlug } = await context.params
  const slug = slugFromParam(rawSlug)

  let body: unknown = {}
  try {
    const parsed = await request.json()
    body = parsed
  } catch {
    body = {}
  }

  const parsed = giveawayEntryBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const result = await enterGiveaway(supabase, {
    userId: user.id,
    userEmail: user.email,
    slug,
    preferredBrand: parsed.data.preferredBrand,
    signedUpFromCta: parsed.data.signedUpFromCta === true,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    { data: { entry: result.entry, alreadyEntered: result.alreadyEntered } },
    { status: 200 },
  )
}
