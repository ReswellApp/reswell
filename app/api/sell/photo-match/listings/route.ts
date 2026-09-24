import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { searchActiveSurfboardListingsForPhotoMatch } from "@/lib/db/sell-photo-listing-images"
import { isSellPhotoMatchEnabled } from "@/lib/services/sellPhotoMatch"
import { getDb } from "@/lib/supabase/db"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const querySchema = z.object({
  q: z.string().trim().min(2).max(80),
})

/**
 * GET /api/sell/photo-match/listings?q=
 * Admin-only search of active surfboard listings and their photos.
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: "Not available." }, { status: 404 })
    const isAdmin = await fetchProfileIsAdmin(supabaseAuth, user.id)
    if (!isAdmin) return NextResponse.json({ error: "Not available." }, { status: 404 })
    if (!isSellPhotoMatchEnabled()) {
      return NextResponse.json({ error: "Photo matching is not configured." }, { status: 503 })
    }

    const parsed = querySchema.safeParse({
      q: new URL(req.url).searchParams.get("q") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter at least two characters." }, { status: 400 })
    }

    const listings = await searchActiveSurfboardListingsForPhotoMatch(
      getDb({ consistency: "eventual" }),
      parsed.data.q,
    )
    return NextResponse.json({ data: listings })
  } catch (error) {
    console.error("[api/sell/photo-match/listings]", {
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json({ error: "Could not search listings." }, { status: 500 })
  }
}
