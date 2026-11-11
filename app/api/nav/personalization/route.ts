import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  loadNavSearchPersonalizationForUser,
  recordNavRecentlyViewedBrandForUser,
  recordNavSearchPersonalizationQuery,
  removeNavSearchPersonalizationQuery,
} from "@/lib/services/navSearchPersonalization"

const JSON_HEADERS = { "Cache-Control": "no-store" } as const

const bodySchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("record-query"),
    query: z.string(),
  }),
  z.object({
    op: z.literal("remove-query"),
    query: z.string(),
  }),
  z.object({
    op: z.literal("record-brand"),
    name: z.string(),
    slug: z.string().nullable().optional(),
  }),
])

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * GET `/api/nav/personalization`
 * Recent searches / viewed listings / brands for the header idle dropdown.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: JSON_HEADERS })
    }
    const data = await loadNavSearchPersonalizationForUser(userId)
    return NextResponse.json({ data }, { headers: JSON_HEADERS })
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500, headers: JSON_HEADERS })
  }
}

/**
 * POST `/api/nav/personalization`
 * Record or remove a recent search, or persist a recently viewed brand.
 * Route handler so these writes cannot block header search `router.push`.
 */
export async function POST(request: NextRequest) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: JSON_HEADERS })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: JSON_HEADERS })
  }

  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: JSON_HEADERS })
    }

    switch (parsed.data.op) {
      case "record-query":
        await recordNavSearchPersonalizationQuery(userId, parsed.data.query)
        break
      case "remove-query":
        await removeNavSearchPersonalizationQuery(userId, parsed.data.query)
        break
      case "record-brand":
        await recordNavRecentlyViewedBrandForUser(userId, {
          name: parsed.data.name,
          slug: parsed.data.slug,
        })
        break
    }

    return NextResponse.json({ ok: true }, { headers: JSON_HEADERS })
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500, headers: JSON_HEADERS })
  }
}
