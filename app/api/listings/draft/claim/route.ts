import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { claimGuestListingDraftsForUser } from "@/lib/db/listingGuestDrafts"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  SELL_GUEST_DRAFT_COOKIE,
  clearGuestDraftTokenCookie,
  hashGuestDraftToken,
} from "@/lib/sell-flow/guest-draft-token"

/**
 * Attach guest draft rows to the signed-in user as separate drafts.
 * Never merges into an existing account draft.
 */
export async function POST() {
  const { user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SELL_GUEST_DRAFT_COOKIE)?.value?.trim()
    if (!token) {
      return NextResponse.json({ data: { claimedIds: [] as string[] } }, { status: 200 })
    }

    const service = createServiceRoleClient()
    const { claimedIds } = await claimGuestListingDraftsForUser(service, {
      tokenHash: hashGuestDraftToken(token),
      userId: user.id,
    })

    const res = NextResponse.json({ data: { claimedIds } }, { status: 200 })
    clearGuestDraftTokenCookie(res)
    return res
  } catch {
    return NextResponse.json({ error: "Failed to claim drafts" }, { status: 500 })
  }
}
