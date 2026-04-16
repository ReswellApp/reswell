import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listingDraftAutosaveSchema } from "@/lib/validations/listing-draft-autosave"
import { upsertSurfboardListingDraft } from "@/lib/services/listingDraftAutosave"
import { deleteListingDocument } from "@/lib/elasticsearch/listings-index"
import {
  fetchListingImageUrlsForListingIds,
  removeListingImageFilesFromStorage,
} from "@/lib/services/listingStorageCleanup"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let q = supabase
      .from("listings")
      .select("id, updated_at")
      .eq("user_id", user.id)
      .eq("section", "surfboards")
      .eq("status", "draft")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let { data, error } = await q
    if (
      error &&
      (error.code === "42703" ||
        (typeof error.message === "string" && error.message.includes("archived_at")))
    ) {
      const fallback = await supabase
        .from("listings")
        .select("id, updated_at")
        .eq("user_id", user.id)
        .eq("section", "surfboards")
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      data = fallback.data
      error = fallback.error
    }

    if (error) {
      return NextResponse.json({ error: "Failed to load draft" }, { status: 500 })
    }

    return NextResponse.json({ data: { draft: data ?? null } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to load draft" }, { status: 500 })
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
    const parsed = listingDraftAutosaveSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { id } = await upsertSurfboardListingDraft(supabase, user.id, parsed.data)
    return NextResponse.json({ data: { id } }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save draft"
    const status = msg === "Forbidden" ? 403 : msg === "Draft not found" ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get("id")?.trim()
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const { data: row, error: loadErr } = await supabase
      .from("listings")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle()

    if (loadErr || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if ((row as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if ((row as { status: string }).status !== "draft") {
      return NextResponse.json({ error: "Not a draft" }, { status: 400 })
    }

    const imageUrls = await fetchListingImageUrlsForListingIds(supabase, [id])

    const { error: delErr } = await supabase.from("listings").delete().eq("id", id)
    if (delErr) {
      return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 })
    }

    try {
      await deleteListingDocument(id)
    } catch {
      /* ES optional */
    }

    try {
      await removeListingImageFilesFromStorage(supabase, imageUrls)
    } catch {
      /* best-effort storage cleanup */
    }

    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 })
  }
}
