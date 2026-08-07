import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { listingDraftSaveSchema } from "@/lib/validations/listing-draft-save"
import {
  listSurfboardListingDrafts,
  upsertGuestSurfboardListingDraft,
  upsertSurfboardListingDraft,
} from "@/lib/services/listingDraftAutosave"
import { listFinListingDrafts, upsertFinListingDraft } from "@/lib/services/finListingDraft"
import { listGuestSurfboardDrafts } from "@/lib/db/listingGuestDrafts"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  SELL_GUEST_DRAFT_COOKIE,
  createGuestDraftToken,
  hashGuestDraftToken,
  setGuestDraftTokenCookie,
} from "@/lib/sell-flow/guest-draft-token"

async function resolveGuestTokenHash(
  request: NextRequest,
): Promise<{ token: string; hash: string; isNew: boolean } | null> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(SELL_GUEST_DRAFT_COOKIE)?.value?.trim()
  if (existing) {
    return { token: existing, hash: hashGuestDraftToken(existing), isNew: false }
  }
  // Only mint on write paths — callers pass createIfMissing.
  void request
  return null
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()
  const sectionParam = request.nextUrl.searchParams.get("section")?.trim()
  if (sectionParam !== "surfboards" && sectionParam !== "fins") {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 })
  }

  try {
    if (user) {
      const drafts =
        sectionParam === "fins"
          ? await listFinListingDrafts(supabase, user.id)
          : await listSurfboardListingDrafts(supabase, user.id)
      return NextResponse.json({ data: { drafts } }, { status: 200 })
    }

    // Guests: surfboard drafts only (Quick). Fins guest server drafts later.
    if (sectionParam !== "surfboards") {
      return NextResponse.json({ data: { drafts: [] } }, { status: 200 })
    }

    const guest = await resolveGuestTokenHash(request)
    if (!guest) {
      return NextResponse.json({ data: { drafts: [] } }, { status: 200 })
    }

    const service = createServiceRoleClient()
    const drafts = await listGuestSurfboardDrafts(service, guest.hash)
    return NextResponse.json({ data: { drafts } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to load drafts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()

  try {
    const json: unknown = await request.json()
    const parsed = listingDraftSaveSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const input = parsed.data

    if (user) {
      const { id } =
        input.section === "fins"
          ? await upsertFinListingDraft(supabase, user.id, input)
          : await upsertSurfboardListingDraft(supabase, user.id, input)
      return NextResponse.json({ data: { id } }, { status: 200 })
    }

    if (input.section !== "surfboards") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cookieStore = await cookies()
    let token = cookieStore.get(SELL_GUEST_DRAFT_COOKIE)?.value?.trim() ?? ""
    let isNew = false
    if (!token) {
      token = createGuestDraftToken()
      isNew = true
    }
    const hash = hashGuestDraftToken(token)
    const service = createServiceRoleClient()

    try {
      const { id } = await upsertGuestSurfboardListingDraft(service, hash, input)
      const res = NextResponse.json({ data: { id } }, { status: 200 })
      if (isNew) setGuestDraftTokenCookie(res, token)
      else setGuestDraftTokenCookie(res, token) // refresh maxAge
      return res
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save draft"
      if (msg === "Guest draft limit reached") {
        return NextResponse.json({ error: msg }, { status: 429 })
      }
      if (msg === "Draft not found" || msg === "Forbidden") {
        return NextResponse.json({ error: msg }, { status: msg === "Forbidden" ? 403 : 404 })
      }
      throw e
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save draft"
    const status = msg === "Forbidden" ? 403 : msg === "Draft not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
