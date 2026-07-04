import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listingDraftSaveSchema } from "@/lib/validations/listing-draft-save"
import {
  listSurfboardListingDrafts,
  upsertSurfboardListingDraft,
} from "@/lib/services/listingDraftAutosave"
import { listFinListingDrafts, upsertFinListingDraft } from "@/lib/services/finListingDraft"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sectionParam = request.nextUrl.searchParams.get("section")?.trim()
    if (sectionParam !== "surfboards" && sectionParam !== "fins") {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    const drafts =
      sectionParam === "fins"
        ? await listFinListingDrafts(supabase, user.id)
        : await listSurfboardListingDrafts(supabase, user.id)

    return NextResponse.json({ data: { drafts } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to load drafts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const json: unknown = await request.json()
    const parsed = listingDraftSaveSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const input = parsed.data
    const { id } =
      input.section === "fins"
        ? await upsertFinListingDraft(supabase, user.id, input)
        : await upsertSurfboardListingDraft(supabase, user.id, input)

    return NextResponse.json({ data: { id } }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save draft"
    const status = msg === "Forbidden" ? 403 : msg === "Draft not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
